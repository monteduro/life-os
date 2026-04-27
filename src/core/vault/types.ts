export interface VaultFolderNode {
  id: string
  path: string
  name: string
  parentPath: string | null
  documentCount: number
  children: VaultFolderNode[]
}

export interface VaultDocumentSummary {
  id: string
  path: string
  name: string
  title: string
  parentPath: string | null
  excerpt: string
  updatedAt: string | null
}

export interface VaultSnapshot {
  rootPath: string
  rootName: string
  folders: VaultFolderNode[]
  documents: VaultDocumentSummary[]
  documentCount: number
}

export interface VaultDocument {
  path: string
  name: string
  title: string
  excerpt: string
  body: string
  rawContent: string
  updatedAt: string | null
}

export interface CreateVaultDocumentInput {
  rootPath: string
  parentPath: string | null
  title?: string
  content?: string
}

export interface SaveVaultDocumentInput {
  path: string
  content: string
}

export interface MoveVaultDocumentInput {
  path: string
  targetFolderPath: string
  fileName?: string
}
