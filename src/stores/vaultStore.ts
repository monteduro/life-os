import { create } from 'zustand'

import { rebuildLocalIndex } from '../core/index/localIndexClient'
import type { LocalIndexStats } from '../core/index/types'
import { useNavigationStore } from './navigationStore'
import { pickVaultDirectory } from '../core/vault/tauriVaultClient'
import {
  activeDocumentRepository,
  activeWorkspaceRepository,
} from '../core/storage/activeStorage'
import type { VaultDocument, VaultSnapshot } from '../core/vault/types'

const RECENT_VAULT_PATH_KEY = 'smart-notes.desktop.recent-vault-path'

type VaultStatus = 'idle' | 'loading' | 'ready' | 'error'
type IndexStatus = 'idle' | 'indexing' | 'ready' | 'error'

interface VaultState {
  status: VaultStatus
  indexStatus: IndexStatus
  error: string | null
  indexError: string | null
  currentVault: VaultSnapshot | null
  selectedDocument: VaultDocument | null
  selectedDocumentPath: string | null
  isReadingDocument: boolean
  currentIndex: LocalIndexStats | null
  loadRecentVault: () => Promise<void>
  openVault: () => Promise<void>
  loadVault: (rootPath: string) => Promise<void>
  rescanVault: () => Promise<void>
  selectDocument: (path: string | null) => Promise<void>
  createDocument: (parentPath: string | null, title?: string) => Promise<VaultDocument | null>
  saveDocument: (path: string, content: string) => Promise<VaultDocument | null>
  deleteDocument: (path: string) => Promise<void>
  clearError: () => void
}

function persistRecentVaultPath(path: string) {
  localStorage.setItem(RECENT_VAULT_PATH_KEY, path)
}

function readRecentVaultPath() {
  return localStorage.getItem(RECENT_VAULT_PATH_KEY)
}

async function refreshCurrentVaultSnapshot() {
  const state = useVaultStore.getState()
  const rootPath = state.currentVault?.rootPath
  if (!rootPath) {
    return null
  }

  const snapshot = await activeWorkspaceRepository.scanWorkspace(rootPath)
  useVaultStore.setState({ currentVault: snapshot, error: null })
  return snapshot
}

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'idle',
  indexStatus: 'idle',
  error: null,
  indexError: null,
  currentVault: null,
  selectedDocument: null,
  selectedDocumentPath: null,
  isReadingDocument: false,
  currentIndex: null,

  async loadRecentVault() {
    const recentPath = readRecentVaultPath()
    if (!recentPath || get().status === 'loading') {
      return
    }

    await get().loadVault(recentPath)
  },

  async openVault() {
    try {
      const selectedPath = await pickVaultDirectory()
      if (!selectedPath) {
        return
      }

      await get().loadVault(selectedPath)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Impossibile aprire la cartella selezionata.',
        status: 'error',
      })
    }
  },

  async loadVault(rootPath) {
    set({
      status: 'loading',
      indexStatus: 'idle',
      error: null,
      indexError: null,
      currentVault: null,
      selectedDocument: null,
      selectedDocumentPath: null,
      isReadingDocument: false,
      currentIndex: null,
    })

    try {
      const snapshot = await activeWorkspaceRepository.scanWorkspace(rootPath)
      persistRecentVaultPath(snapshot.rootPath)

      useNavigationStore.getState().selectInbox()

      set({
        status: 'ready',
        indexStatus: 'indexing',
        error: null,
        currentVault: snapshot,
      })

      try {
        const indexStats = await rebuildLocalIndex(snapshot.rootPath)
        set({
          currentIndex: indexStats,
          indexStatus: 'ready',
          indexError: null,
        })
      } catch (error) {
        set({
          indexStatus: 'error',
          indexError: error instanceof Error ? error.message : 'Indicizzazione SQLite fallita.',
        })
      }
    } catch (error) {
      set({
        status: 'error',
        indexStatus: 'idle',
        error: error instanceof Error ? error.message : 'Indicizzazione iniziale fallita.',
        currentVault: null,
      })
    }
  },

  async rescanVault() {
    const rootPath = get().currentVault?.rootPath
    if (!rootPath) {
      return
    }

    await get().loadVault(rootPath)
  },

  async selectDocument(path) {
    if (!path) {
      set({
        selectedDocumentPath: null,
        selectedDocument: null,
        isReadingDocument: false,
      })
      return
    }

    set({
      selectedDocumentPath: path,
      isReadingDocument: true,
      error: null,
    })

    try {
      const document = await activeDocumentRepository.readDocument(path)
      set({
        selectedDocument: document,
        isReadingDocument: false,
      })
    } catch (error) {
      set({
        selectedDocument: null,
        isReadingDocument: false,
        error: error instanceof Error ? error.message : 'Impossibile leggere il file selezionato.',
      })
    }
  },

  async createDocument(parentPath, title) {
    const rootPath = get().currentVault?.rootPath
    if (!rootPath) {
      set({ error: 'Nessun vault aperto.' })
      return null
    }

    try {
      const document = await activeDocumentRepository.createDocument({
        rootPath,
        parentPath,
        title,
      })
      await refreshCurrentVaultSnapshot()
      await get().selectDocument(document.path)
      return document
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Impossibile creare il documento.',
      })
      return null
    }
  },

  async saveDocument(path, content) {
    try {
      const document = await activeDocumentRepository.saveDocument({ path, content })
      await refreshCurrentVaultSnapshot()
      set({
        selectedDocument: document,
        selectedDocumentPath: document.path,
        error: null,
      })
      return document
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Impossibile salvare il documento.',
      })
      return null
    }
  },

  async deleteDocument(path) {
    try {
      await activeDocumentRepository.deleteDocument(path)
      await refreshCurrentVaultSnapshot()

      const selectedPath = get().selectedDocumentPath
      if (selectedPath === path) {
        set({
          selectedDocument: null,
          selectedDocumentPath: null,
          isReadingDocument: false,
        })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Impossibile eliminare il documento.',
      })
    }
  },

  clearError() {
    set({ error: null })
  },
}))
