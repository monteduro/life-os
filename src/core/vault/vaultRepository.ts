import {
  createVaultDocument,
  deleteVaultDocument,
  moveVaultDocument,
  readVaultDocument,
  saveVaultDocument,
  scanVault,
} from './tauriVaultClient'
import type {
  CreateVaultDocumentInput,
  MoveVaultDocumentInput,
  SaveVaultDocumentInput,
} from './types'
import type { DocumentRepository } from '../ports/documentRepository'
import type { WorkspaceRepository } from '../ports/workspaceRepository'

export const localMarkdownRepository: WorkspaceRepository & DocumentRepository = {
  scanWorkspace: scanVault,
  readDocument: readVaultDocument,
  createDocument: (input: CreateVaultDocumentInput) => createVaultDocument(input),
  saveDocument: (input: SaveVaultDocumentInput) => saveVaultDocument(input),
  deleteDocument: (path: string) => deleteVaultDocument(path),
  moveDocument: (input: MoveVaultDocumentInput) => moveVaultDocument(input),
}

export const vaultRepository = {
  scan: localMarkdownRepository.scanWorkspace,
  readDocument: localMarkdownRepository.readDocument,
  createDocument: localMarkdownRepository.createDocument,
  saveDocument: localMarkdownRepository.saveDocument,
  deleteDocument: localMarkdownRepository.deleteDocument,
  moveDocument: localMarkdownRepository.moveDocument,
}
