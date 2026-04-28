import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import type {
  CreateVaultFolderInput,
  CreateVaultDocumentInput,
  MoveVaultDocumentInput,
  RenameVaultFolderInput,
  SaveVaultDocumentInput,
  VaultDocument,
  VaultSnapshot,
} from './types'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

function ensureDesktopShell() {
  if (!window.__TAURI_INTERNALS__) {
    throw new Error('Desktop shell non disponibile. Avvia l’app con `npm run tauri:dev`.')
  }
}

export async function pickVaultDirectory() {
  ensureDesktopShell()

  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Apri una cartella Markdown',
  })

  return typeof selected === 'string' ? selected : null
}

export async function scanVault(rootPath: string) {
  ensureDesktopShell()
  return invoke<VaultSnapshot>('scan_vault', { rootPath })
}

export async function createVaultFolder(input: CreateVaultFolderInput) {
  ensureDesktopShell()
  return invoke<string>('create_folder', { ...input })
}

export async function renameVaultFolder(input: RenameVaultFolderInput) {
  ensureDesktopShell()
  return invoke<string>('rename_folder', { ...input })
}

export async function readVaultDocument(path: string) {
  ensureDesktopShell()
  return invoke<VaultDocument>('read_document', { path })
}

export async function createVaultDocument(input: CreateVaultDocumentInput) {
  ensureDesktopShell()
  return invoke<VaultDocument>('create_document', { ...input })
}

export async function saveVaultDocument(input: SaveVaultDocumentInput) {
  ensureDesktopShell()
  return invoke<VaultDocument>('save_document', { ...input })
}

export async function deleteVaultDocument(path: string) {
  ensureDesktopShell()
  return invoke<void>('delete_document', { path })
}

export async function moveVaultDocument(input: MoveVaultDocumentInput) {
  ensureDesktopShell()
  return invoke<VaultDocument>('move_document', { ...input })
}

export async function startVaultWatcher(rootPath: string) {
  ensureDesktopShell()
  return invoke<void>('start_vault_watcher', { rootPath })
}
