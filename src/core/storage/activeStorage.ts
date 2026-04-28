import type { StorageCapabilities } from '../domain/storage'
import type { DocumentRepository } from '../ports/documentRepository'
import type { WorkspaceRepository } from '../ports/workspaceRepository'
import { localMarkdownRepository } from '../vault/vaultRepository'

export const activeStorageCapabilities: StorageCapabilities = {
  mode: 'local_markdown',
  sourceOfTruth: 'filesystem',
  supportsExternalEditing: true,
  supportsRealtimeSync: false,
  supportsOfflineFirst: true,
  supportsStructuredQueries: false,
}

export const activeWorkspaceRepository: WorkspaceRepository = localMarkdownRepository
export const activeDocumentRepository: DocumentRepository = localMarkdownRepository
