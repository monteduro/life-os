import { useEffect, useCallback, useRef } from "react"
import { EditorContent, EditorContext, useEditor, ReactNodeViewRenderer } from "@tiptap/react"
import { EditorCallbacksContext } from "./EditorCallbacksContext"

// --- TipTap Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { TableKit } from "@tiptap/extension-table"
import { Mention } from "@tiptap/extension-mention"

// --- Custom Extensions ---
import { DateDetectionExtension, type DetectedDate } from "../../extensions/date-detection-extension"
import { mentionSuggestion } from "../../extensions/mention-suggestion"
import { MentionNodeView } from "./MentionNodeView"

// --- UI Primitives ---
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- TipTap Node styles ---
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- TipTap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"
import { TableButton } from "./TableButton"
import { TableToolbar } from "./TableToolbar"

// --- Types ---
import type { TipTapDocument } from "../../api/notesApi"

interface NoteEditorProps {
  content?: TipTapDocument
  onChange?: (doc: TipTapDocument, plainText: string) => void
  onDateDetected?: (date: DetectedDate | null) => void
  onSave?: () => void
  onBeforeNavigate?: () => Promise<void> | void
  placeholder?: string
  editorKey?: number
  autofocus?: boolean
  preferredDateRaw?: string
  /** Lingua per il date detection (es. "it", "en"). Fallback: navigator.language */
  lang?: string | null
}

export default function NoteEditor({
  content,
  onChange,
  onDateDetected,
  onSave,
  onBeforeNavigate,
  placeholder = "Scrivi una nota... (supporta sintassi Markdown)",
  editorKey,
  autofocus = false,
  preferredDateRaw,
  lang,
}: NoteEditorProps) {
  const handleUpdate = useCallback(
    ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
      if (!editor) return
      const json = editor.getJSON() as TipTapDocument
      const plainText = editor.getText()
      onChange?.(json, plainText)
    },
    [onChange],
  )

  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: autofocus ? 'end' : false,
      editorProps: {
        attributes: {
          autocomplete: "off",
          autocorrect: "off",
          autocapitalize: "off",
          "aria-label": placeholder,
          class: "note-editor-tiptap",
        },
        handleKeyDown: (_view, event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 's') {
            event.preventDefault()
            onSaveRef.current?.()
            return true
          }
          return false
        },
      },
      extensions: [
        StarterKit,
        TaskList,
        TaskItem.configure({ nested: true }),
        Typography,
        Highlight.configure({ multicolor: true }),
        TableKit.configure({
          table: {
            resizable: true
          },
        }),
        DateDetectionExtension.configure({ onDateDetected, preferredRaw: preferredDateRaw, lang }),
        Mention.extend({
          // Add a `type` attribute to store the mention entity type (e.g. 'folder')
          addAttributes() {
            return {
              ...this.parent?.(),
              type: {
                default: null,
                parseHTML: element => element.getAttribute('data-mention-type'),
                renderHTML: attributes => {
                  if (!attributes.type) return {}
                  return { 'data-mention-type': attributes.type }
                },
              },
            }
          },
          // Render as an interactive React component (with popover on click)
          addNodeView() {
            return ReactNodeViewRenderer(MentionNodeView)
          },
        }).configure({
          HTMLAttributes: { class: 'mention' },
          suggestion: mentionSuggestion,
          renderText({ node }) {
            return `@${node.attrs.label ?? node.attrs.id}`
          },
        }),
      ],
      content: content ?? undefined,
      onUpdate: handleUpdate,
    },
    [editorKey],
  )

  // Sync content from outside when editorKey changes (reset)
  useEffect(() => {
    if (editor && content === undefined) {
      editor.commands.clearContent()
    }
  }, [editorKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <EditorCallbacksContext.Provider value={{ onBeforeNavigate }}>
      <div className="w-full bg-transparent border-none rounded-none shadow-none">
        <EditorContext.Provider value={{ editor }}>
          <div className="sticky z-10 bg-white/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 pb-2 pt-1 mb-1" style={{ top: 'var(--navbar-height)' }}>
            <div className="note-editor-toolbar-scroll">
              <Toolbar className="!border-none !bg-transparent !p-0 !mb-0">
                <ToolbarGroup>
                  <UndoRedoButton action="undo" />
                  <UndoRedoButton action="redo" />
                </ToolbarGroup>

                <ToolbarSeparator />

                <ToolbarGroup>
                  <HeadingDropdownMenu levels={[1, 2, 3]} />
                  <ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} />
                  <BlockquoteButton />
                  <CodeBlockButton />
                  <TableButton />
                </ToolbarGroup>

                <ToolbarSeparator />

                <ToolbarGroup>
                  <MarkButton type="bold" />
                  <MarkButton type="italic" />
                  <MarkButton type="strike" />
                  <MarkButton type="code" />
                </ToolbarGroup>

                <TableToolbar />
              </Toolbar>
            </div>
          </div>

          <EditorContent
            editor={editor}
            role="presentation"
            className="note-editor-content"
          />
        </EditorContext.Provider>
      </div>
    </EditorCallbacksContext.Provider>
  )
}
