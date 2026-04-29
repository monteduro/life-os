export type StorageMode = 'local_markdown' | 'remote_postgres'

export interface FolderNode {
  id: string
  path: string
  name: string
  parentPath: string | null
  documentCount: number
  children: FolderNode[]
}

export interface DocumentSummary {
  id: string
  path: string
  name: string
  title: string
  parentPath: string | null
  excerpt: string
  dueDate: string | null
  dueDateRaw: string | null
  completedAt: string | null
  updatedAt: string | null
}

export interface WorkspaceSnapshot {
  rootPath: string
  rootName: string
  folders: FolderNode[]
  documents: DocumentSummary[]
  documentCount: number
}

export interface CreateFolderInput {
  rootPath: string
  parentPath: string | null
  name: string
}

export interface RenameFolderInput {
  path: string
  name: string
}

export interface MoveFolderInput {
  rootPath: string
  path: string
  targetParentPath: string | null
}

export interface DocumentRecord {
  path: string
  name: string
  title: string
  excerpt: string
  body: string
  rawContent: string
  updatedAt: string | null
}

export interface CreateDocumentInput {
  rootPath: string
  parentPath: string | null
  title?: string
  content?: string
}

export interface SaveDocumentInput {
  path: string
  content: string
}

export interface MoveDocumentInput {
  path: string
  targetFolderPath: string
  fileName?: string
}

export interface StorageCapabilities {
  mode: StorageMode
  sourceOfTruth: 'filesystem' | 'remote_database'
  supportsExternalEditing: boolean
  supportsRealtimeSync: boolean
  supportsOfflineFirst: boolean
  supportsStructuredQueries: boolean
}
