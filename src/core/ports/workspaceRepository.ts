import type { WorkspaceSnapshot } from '../domain/storage'

export interface WorkspaceRepository {
  scanWorkspace(rootPath: string): Promise<WorkspaceSnapshot>
}
