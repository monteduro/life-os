import type {
  CreateFolderInput,
  MoveFolderInput,
  RenameFolderInput,
  WorkspaceSnapshot,
} from '../domain/storage'

export interface WorkspaceRepository {
  scanWorkspace(rootPath: string): Promise<WorkspaceSnapshot>
  createFolder(input: CreateFolderInput): Promise<string>
  renameFolder(input: RenameFolderInput): Promise<string>
  moveFolder(input: MoveFolderInput): Promise<string>
}
