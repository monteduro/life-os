import type { Folder, Note, TipTapDocument } from '../../types'
import type { VaultDocumentSummary, VaultFolderNode } from './types'

const EMPTY_DOC: TipTapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

function createPlainTextDoc(text: string): TipTapDocument {
  if (!text.trim()) {
    return EMPTY_DOC
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

function timestampToIso(timestamp: string | null) {
  if (!timestamp) {
    return new Date(0).toISOString()
  }

  const numericTimestamp = Number(timestamp)
  if (Number.isNaN(numericTimestamp)) {
    return new Date(0).toISOString()
  }

  return new Date(numericTimestamp * 1000).toISOString()
}

function mapFolderNode(node: VaultFolderNode): Folder {
  const timestamp = new Date(0).toISOString()

  return {
    id: node.path,
    parent_id: node.parentPath,
    name: node.name,
    description: null,
    icon: null,
    due_date: null,
    sort_order: 0,
    is_archived: false,
    notes_count: node.documentCount,
    children: node.children.map(mapFolderNode),
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export function mapVaultFoldersToAppFolders(folders: VaultFolderNode[]) {
  return folders.map(mapFolderNode)
}

export function mapVaultDocumentsToNotes(documents: VaultDocumentSummary[]): Note[] {
  return [...documents]
    .sort((left, right) => {
      const rightValue = Number(right.updatedAt ?? 0)
      const leftValue = Number(left.updatedAt ?? 0)
      return rightValue - leftValue
    })
    .map((document, index) => ({
      id: document.path,
      content: createPlainTextDoc(document.excerpt),
      content_plain: document.excerpt,
      folder_id: document.parentPath,
      due_date: document.dueDate,
      due_date_raw: document.dueDateRaw,
      completed_at: document.completedAt ?? null,
      is_task: false,
      is_archived: false,
      sort_order: index,
      created_at: timestampToIso(document.updatedAt),
      updated_at: timestampToIso(document.updatedAt),
      deleted_at: null,
      attachments: [],
      mentions: [],
    }))
}
