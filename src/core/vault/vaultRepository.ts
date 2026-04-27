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

export const vaultRepository = {
  scan: scanVault,
  readDocument: readVaultDocument,
  createDocument: (input: CreateVaultDocumentInput) => createVaultDocument(input),
  saveDocument: (input: SaveVaultDocumentInput) => saveVaultDocument(input),
  deleteDocument: (path: string) => deleteVaultDocument(path),
  moveDocument: (input: MoveVaultDocumentInput) => moveVaultDocument(input),
}
