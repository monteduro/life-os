import AppLayout from './components/layout/AppLayout'
import NoteList from './components/notes/NoteList'
import VaultBootstrap from './components/vault/VaultBootstrap'
import { useVaultStore } from './stores/vaultStore'
import { useNavigationStore } from './stores/navigationStore'

function App() {
  const { currentVault, status } = useVaultStore()
  const { selectedFolderId } = useNavigationStore()

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
