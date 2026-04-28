import {
  createVaultFolder,
  createVaultDocument,
  deleteVaultDocument,
  moveVaultFolder,
  moveVaultDocument,
  readVaultDocument,
  renameVaultFolder,
  saveVaultDocument,
  scanVault,
} from './tauriVaultClient'
import type {
  CreateVaultFolderInput,
  CreateVaultDocumentInput,
  MoveVaultFolderInput,
  MoveVaultDocumentInput,
  RenameVaultFolderInput,
  SaveVaultDocumentInput,
} from './types'
import type { DocumentRepository } from '../ports/documentRepository'
import type { WorkspaceRepository } from '../ports/workspaceRepository'

export const localMarkdownRepository: WorkspaceRepository & DocumentRepository = {
  scanWorkspace: scanVault,
  createFolder: (input: CreateVaultFolderInput) => createVaultFolder(input),
  renameFolder: (input: RenameVaultFolderInput) => renameVaultFolder(input),
  moveFolder: (input: MoveVaultFolderInput) => moveVaultFolder(input),
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
