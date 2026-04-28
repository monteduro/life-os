import MarkdownIt from 'markdown-it'

import { getVaultPathLabel } from './paths'
import type { TipTapDocument, TipTapNode } from '../../types'

const markdownParser = new MarkdownIt('commonmark', {
  breaks: false,
  html: false,
  linkify: false,
}).enable('strikethrough')

type MarkdownToken = ReturnType<MarkdownIt['parse']>[number]

interface RawVaultDocumentParts {
  frontmatter: string | null
  body: string
}

const EMPTY_DOCUMENT: TipTapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function splitRawVaultDocument(rawContent: string): RawVaultDocumentParts {
  if (!rawContent.startsWith('---\n')) {
    return { frontmatter: null, body: rawContent.trim() }
  }

  const closingIndex = rawContent.indexOf('\n---', 4)
  if (closingIndex === -1) {
    return { frontmatter: null, body: rawContent.trim() }
  }

  const closingEnd = rawContent.indexOf('\n', closingIndex + 4)
  const frontmatterEnd = closingEnd === -1 ? rawContent.length : closingEnd
  const frontmatter = rawContent.slice(0, frontmatterEnd).trim()
  const body = rawContent.slice(frontmatterEnd).trim()

  return {
    frontmatter,
    body,
  }
}

export function mergeRawVaultDocument(parts: RawVaultDocumentParts) {
  const normalizedBody = parts.body.trimEnd()

  if (!parts.frontmatter) {
    return normalizedBody
  }

  if (!normalizedBody) {
    return `${parts.frontmatter}\n`
  }

  return `${parts.frontmatter}\n\n${normalizedBody}\n`
}

export function markdownToTipTapDocument(markdown: string): TipTapDocument {
  if (!markdown.trim()) {
    return EMPTY_DOCUMENT
  }

  const tokens = markdownParser.parse(markdown, {})
  const content = parseBlockTokens(tokens, 0, tokens.length)

  return {
    type: 'doc',
    content: content.length > 0 ? content : EMPTY_DOCUMENT.content,
  }
}

export function tipTapDocumentToMarkdown(document: TipTapDocument) {
  const blocks = (document.content ?? [])
    .map((node) => serializeBlock(node, 0))
    .filter((value) => value.trim().length > 0)

  return blocks.join('\n\n').trim()
}

function parseBlockTokens(tokens: MarkdownToken[], start: number, end: number): TipTapNode[] {
  const nodes: TipTapNode[] = []
  let index = start

  while (index < end) {
    const token = tokens[index]

    switch (token.type) {
      case 'paragraph_open': {
        const inlineToken = tokens[index + 1]
        nodes.push({
          type: 'paragraph',
          content: inlineToken ? parseInlineTokens(inlineToken.children ?? []) : [],
        })
        index += 3
        break
      }
      case 'heading_open': {
        const level = Number(token.tag.replace('h', '')) || 1
        const inlineToken = tokens[index + 1]
        nodes.push({
          type: 'heading',
          attrs: { level },
          content: inlineToken ? parseInlineTokens(inlineToken.children ?? []) : [],
        })
        index += 3
        break
      }
      case 'bullet_list_open': {
        const closingIndex = findClosingToken(tokens, index, 'bullet_list_open', 'bullet_list_close')
        const listNodes = parseListItems(tokens, index + 1, closingIndex)
        nodes.push(convertBulletList(listNodes))
        index = closingIndex + 1
        break
      }
      case 'ordered_list_open': {
        const closingIndex = findClosingToken(tokens, index, 'ordered_list_open', 'ordered_list_close')
        nodes.push({
          type: 'orderedList',
          attrs: { start: Number(token.attrGet('start') ?? '1') || 1 },
          content: parseListItems(tokens, index + 1, closingIndex),
        })
        index = closingIndex + 1
        break
      }
      case 'blockquote_open': {
        const closingIndex = findClosingToken(tokens, index, 'blockquote_open', 'blockquote_close')
        nodes.push({
          type: 'blockquote',
          content: parseBlockTokens(tokens, index + 1, closingIndex),
        })
        index = closingIndex + 1
        break
      }
      case 'fence':
      case 'code_block': {
        nodes.push({
          type: 'codeBlock',
          attrs: { language: token.info || null },
          content: token.content ? [{ type: 'text', text: token.content.replace(/\n$/, '') }] : [],
        })
        index += 1
        break
      }
      case 'hr': {
        nodes.push({ type: 'horizontalRule' })
        index += 1
        break
      }
      default: {
        index += 1
        break
      }
    }
  }

  return nodes
}

function parseListItems(tokens: MarkdownToken[], start: number, end: number): TipTapNode[] {
  const items: TipTapNode[] = []
  let index = start

  while (index < end) {
    if (tokens[index]?.type !== 'list_item_open') {
      index += 1
      continue
    }

    const closingIndex = findClosingToken(tokens, index, 'list_item_open', 'list_item_close')
    items.push({
      type: 'listItem',
      content: parseBlockTokens(tokens, index + 1, closingIndex),
    })
    index = closingIndex + 1
  }

  return items
}

function convertBulletList(items: TipTapNode[]): TipTapNode {
  const taskItems = items.map(convertListItemToTaskItem)

  if (taskItems.every((item) => item !== null)) {
    return {
      type: 'taskList',
      content: taskItems.filter((item): item is TipTapNode => item !== null),
    }
  }

  return {
    type: 'bulletList',
    content: items,
  }
}

function convertListItemToTaskItem(item: TipTapNode): TipTapNode | null {
  const firstBlock = item.content?.[0]
  if (!firstBlock || firstBlock.type !== 'paragraph' || !firstBlock.content || firstBlock.content.length === 0) {
    return null
  }

  const firstInline = firstBlock.content[0]
  if (!firstInline.text) {
    return null
  }

  if (firstInline.text.startsWith('[ ] ')) {
    const updatedParagraph = cloneParagraphWithTrimmedPrefix(firstBlock, '[ ] ')
    return {
      type: 'taskItem',
      attrs: { checked: false },
      content: [updatedParagraph, ...(item.content?.slice(1) ?? [])],
    }
  }

  if (firstInline.text.toLowerCase().startsWith('[x] ')) {
    const updatedParagraph = cloneParagraphWithTrimmedPrefix(firstBlock, firstInline.text.slice(0, 4))
    return {
      type: 'taskItem',
      attrs: { checked: true },
      content: [updatedParagraph, ...(item.content?.slice(1) ?? [])],
    }
  }

  return null
}

function cloneParagraphWithTrimmedPrefix(paragraph: TipTapNode, prefix: string): TipTapNode {
  const content = [...(paragraph.content ?? [])]
  const firstInline = { ...content[0] }
  firstInline.text = firstInline.text?.slice(prefix.length) ?? ''
  content[0] = firstInline

  return {
    ...paragraph,
    content,
  }
}

function parseInlineTokens(tokens: MarkdownToken[]): TipTapNode[] {
  const nodes: TipTapNode[] = []
  const marks: Array<{ type: string }> = []

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        if (token.content) {
          nodes.push(...parseInlineText(token.content, marks))
        }
        break
      case 'softbreak':
      case 'hardbreak':
        nodes.push({ type: 'hardBreak' })
        break
      case 'code_inline':
        nodes.push(createTextNode(token.content, [...marks, { type: 'code' }]))
        break
      case 'strong_open':
        marks.push({ type: 'bold' })
        break
      case 'strong_close':
        removeLastMark(marks, 'bold')
        break
      case 'em_open':
        marks.push({ type: 'italic' })
        break
      case 'em_close':
        removeLastMark(marks, 'italic')
        break
      case 's_open':
        marks.push({ type: 'strike' })
        break
      case 's_close':
        removeLastMark(marks, 'strike')
        break
      default:
        break
    }
  }

  return nodes
}

function createTextNode(text: string, marks: Array<{ type: string }>): TipTapNode {
  return {
    type: 'text',
    text,
    ...(marks.length > 0 ? { marks: marks.map((mark) => ({ ...mark })) } : {}),
  }
}

function createMentionNode(targetPath: string, label?: string): TipTapNode {
  const normalizedTargetPath = targetPath.trim()
  const fallbackLabel = getVaultPathLabel(normalizedTargetPath)
  const normalizedLabel = label?.trim() || fallbackLabel

  return {
    type: 'mention',
    attrs: {
      id: normalizedTargetPath,
      label: normalizedLabel,
      type: 'folder',
    },
  }
}

function parseInlineText(text: string, marks: Array<{ type: string }>): TipTapNode[] {
  const nodes: TipTapNode[] = []
  const wikiLinkPattern = /\[\[([^|\]]+?)(?:\|([^\]]+))?\]\]/g
  let lastIndex = 0

  for (const match of text.matchAll(wikiLinkPattern)) {
    const fullMatch = match[0]
    const targetPath = match[1]?.trim()
    const label = match[2]?.trim()
    const matchIndex = match.index ?? -1

    if (!fullMatch || !targetPath || matchIndex < 0) {
      continue
    }

    if (matchIndex > lastIndex) {
      nodes.push(createTextNode(text.slice(lastIndex, matchIndex), marks))
    }

    nodes.push(createMentionNode(targetPath, label))
    lastIndex = matchIndex + fullMatch.length
  }

  if (lastIndex < text.length) {
    nodes.push(createTextNode(text.slice(lastIndex), marks))
  }

  return nodes
}

function removeLastMark(marks: Array<{ type: string }>, type: string) {
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    if (marks[index]?.type === type) {
      marks.splice(index, 1)
      return
    }
  }
}

function findClosingToken(
  tokens: MarkdownToken[],
  start: number,
  openType: string,
  closeType: string,
) {
  let depth = 0

  for (let index = start; index < tokens.length; index += 1) {
    if (tokens[index]?.type === openType) {
      depth += 1
    } else if (tokens[index]?.type === closeType) {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return start
}

function serializeBlock(node: TipTapNode, indent: number): string {
  switch (node.type) {
    case 'paragraph':
      return indentLines(serializeInline(node.content ?? []), indent)
    case 'heading': {
      const level = Number(node.attrs?.level ?? 1)
      return `${'#'.repeat(level)} ${serializeInline(node.content ?? [])}`.trim()
    }
    case 'bulletList':
      return serializeList(node.content ?? [], indent, 'bullet')
    case 'orderedList':
      return serializeList(node.content ?? [], indent, 'ordered', Number(node.attrs?.start ?? 1))
    case 'taskList':
      return serializeList(node.content ?? [], indent, 'task')
    case 'blockquote': {
      const content = (node.content ?? [])
        .map((child) => serializeBlock(child, indent))
        .filter(Boolean)
        .join('\n\n')
      return content
        .split('\n')
        .map((line) => `> ${line}`.trimEnd())
        .join('\n')
    }
    case 'codeBlock': {
      const language = String(node.attrs?.language ?? '').trim()
      const code = (node.content ?? [])
        .map((child) => child.text ?? '')
        .join('')
      return `\`\`\`${language}\n${code}\n\`\`\``.trim()
    }
    case 'horizontalRule':
      return '---'
    default:
      return indentLines(serializeInline(node.content ?? []), indent)
  }
}

function serializeList(
  items: TipTapNode[],
  indent: number,
  kind: 'bullet' | 'ordered' | 'task',
  start = 1,
): string {
  return items
    .map((item, index) => serializeListItem(item, indent, kind, start + index))
    .join('\n')
}

function serializeListItem(
  item: TipTapNode,
  indent: number,
  kind: 'bullet' | 'ordered' | 'task',
  order: number,
) {
  const blocks = item.content ?? []
  const firstBlock = blocks[0] ?? { type: 'paragraph', content: [] }
  const restBlocks = blocks.slice(1)

  const prefix = kind === 'ordered'
    ? `${order}. `
    : kind === 'task'
      ? `- [${item.attrs?.checked ? 'x' : ' '}] `
      : '- '

  const baseIndent = ' '.repeat(indent)
  const continuationIndent = ' '.repeat(indent + prefix.length)
  const firstText = serializeBlock(firstBlock, 0).split('\n')
  const firstLine = `${baseIndent}${prefix}${firstText[0] ?? ''}`
  const continuedLines = firstText.slice(1).map((line) => `${continuationIndent}${line}`)
  const trailingBlocks = restBlocks.map((block) => serializeBlock(block, indent + 2))

  return [firstLine, ...continuedLines, ...trailingBlocks].filter(Boolean).join('\n')
}

function serializeInline(content: TipTapNode[]): string {
  return content
    .map((node) => {
      if (node.type === 'text') {
        return applyMarks(node.text ?? '', node.marks ?? [])
      }

      if (node.type === 'hardBreak') {
        return '\n'
      }

      if (node.type === 'mention') {
        return serializeMention(node)
      }

      return serializeInline(node.content ?? [])
    })
    .join('')
}

function serializeMention(node: TipTapNode) {
  const id = String(node.attrs?.id ?? '').trim()
  if (!id) {
    return ''
  }

  const label = String(node.attrs?.label ?? '').trim()
  const fallbackLabel = getVaultPathLabel(id)

  if (!label || label === fallbackLabel) {
    return `[[${id}]]`
  }

  return `[[${id}|${label}]]`
}

function applyMarks(text: string, marks: Array<{ type: string; attrs?: Record<string, unknown> }>) {
  return [...marks].reduce((value, mark) => {
    switch (mark.type) {
      case 'code':
        return `\`${value}\``
      case 'bold':
        return `**${value}**`
      case 'italic':
        return `*${value}*`
      case 'strike':
        return `~~${value}~~`
      default:
        return value
    }
  }, text)
}

function indentLines(content: string, indent: number) {
  if (!content) {
    return ''
  }

  const padding = ' '.repeat(indent)
  return content
    .split('\n')
    .map((line) => `${padding}${line}`)
    .join('\n')
}
