import { useEffect } from 'react'

import { listen } from '@tauri-apps/api/event'

import AppLayout from './components/layout/AppLayout'
import NoteList from './components/notes/NoteList'
import VaultBootstrap from './components/vault/VaultBootstrap'
import { useVaultStore } from './stores/vaultStore'
import { useNavigationStore } from './stores/navigationStore'

function App() {
  const {
    currentVault,
    status,
    refreshVaultSnapshot,
    searchQuery,
    runSearch,
  } = useVaultStore()
  const { selectedFolderId } = useNavigationStore()

  useEffect(() => {
    if (!currentVault || !window.__TAURI_INTERNALS__) {
      return
    }

    let isMounted = true

    const unlistenPromise = listen<{ rootPath: string }>('vault-watch-updated', async (event) => {
      if (!isMounted) {
        return
      }

      if (event.payload.rootPath !== currentVault.rootPath) {
        return
      }

      await refreshVaultSnapshot()

      if (searchQuery.trim()) {
        await runSearch(searchQuery)
      }
    })

    return () => {
      isMounted = false
      void unlistenPromise.then((unlisten) => unlisten())
    }
  }, [currentVault, refreshVaultSnapshot, runSearch, searchQuery])

  if (status === 'ready' && currentVault) {
    return (
      <AppLayout>
        <NoteList folderId={selectedFolderId} />
      </AppLayout>
    )
  }

  return <VaultBootstrap />
}

export default App
