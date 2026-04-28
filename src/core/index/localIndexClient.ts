import { invoke } from '@tauri-apps/api/core'

import type { VaultDocumentSummary } from '../vault/types'
import type { LocalIndexStats } from './types'

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

export async function rebuildLocalIndex(rootPath: string) {
  ensureDesktopShell()
  return invoke<LocalIndexStats>('rebuild_local_index', { rootPath })
}

export async function searchLocalIndex(rootPath: string, query: string) {
  ensureDesktopShell()
  return invoke<VaultDocumentSummary[]>('search_local_index', { rootPath, query })
}
