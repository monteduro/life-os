import type {
  CreateFolderInput,
  RenameFolderInput,
  WorkspaceSnapshot,
} from '../domain/storage'

export interface WorkspaceRepository {
  scanWorkspace(rootPath: string): Promise<WorkspaceSnapshot>
  createFolder(input: CreateFolderInput): Promise<string>
  renameFolder(input: RenameFolderInput): Promise<string>
}
