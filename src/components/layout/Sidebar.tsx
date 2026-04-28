import { useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import { mapVaultFoldersToAppFolders } from '../../core/vault/adapters'
import { getIcon } from '../../lib/iconMap'
import TextPromptDialog from '../Form/TextPromptDialog'
import SidebarNavItem from './SidebarNavItem'
import FolderTree from './FolderTree'
import type { Folder } from '../../types'

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { currentVault, createFolder } = useVaultStore()
  const [createFolderOpen, setCreateFolderOpen] = useState(false)

  const { selectedFolderId, sidebarOpen, selectFolder, selectInbox } = useNavigationStore()

  const folderTree = currentVault ? mapVaultFoldersToAppFolders(currentVault.folders) : []

  const inboxCount = currentVault
    ? currentVault.documents.filter((document) => document.parentPath === null).length
    : 0

  const handleCreateFolder = async (name: string) => {
    if (!currentVault) return

    const folderPath = await createFolder(selectedFolderId, name.trim())
    if (!folderPath) return

    const folderName = folderPath.split('/').pop() ?? name.trim()
    selectFolder(folderPath, folderName)
    setCreateFolderOpen(false)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="
          hidden lg:flex
          w-64 flex-col bg-white border-r border-stone-100
          h-screen sticky top-0 overflow-y-auto
        "
      >
        <SidebarContent
          folderTree={folderTree}
          inboxCount={inboxCount}
          selectedFolderId={selectedFolderId}
          selectInbox={selectInbox}
          onCreateFolder={() => setCreateFolderOpen(true)}
        />
      </aside>

      {/* Mobile sidebar (overlay) */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50
          w-64 flex flex-col bg-white border-r border-stone-100
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent
          folderTree={folderTree}
          inboxCount={inboxCount}
          selectedFolderId={selectedFolderId}
          selectInbox={selectInbox}
          onCreateFolder={() => setCreateFolderOpen(true)}
        />
      </aside>

      <TextPromptDialog
        open={createFolderOpen}
        title="Create folder"
        description={selectedFolderId ? 'The new folder will be created inside the currently selected folder.' : 'The new folder will be created at the vault root.'}
        placeholder="Folder name"
        confirmLabel="Create"
        cancelLabel="Cancel"
        onCancel={() => setCreateFolderOpen(false)}
        onConfirm={handleCreateFolder}
      />
    </>
  )
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────

interface SidebarContentProps {
  folderTree: Folder[]
  inboxCount: number
  selectedFolderId: string | null
  selectInbox: () => void
  onCreateFolder: () => void
}

function SidebarContent({
  folderTree,
  inboxCount,
  selectedFolderId,
  selectInbox,
  onCreateFolder,
}: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div
        className="px-6 flex items-center justify-between border-b border-stone-100 shrink-0"
        style={{ height: 'var(--navbar-height)' }}
      >
        <span className="text-base font-semibold text-stone-800 tracking-tight">
          smart<span className="text-stone-400 font-normal">notes</span>
        </span>
        <button
          type="button"
          onClick={() => {
            void onCreateFolder()
          }}
          className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          aria-label="Create folder"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col">
        {/* Inbox */}
        <div className="mb-1">
          <SidebarNavItem
            Icon={getIcon(null, 'inbox')}
            label="Root"
            count={inboxCount}
            isActive={selectedFolderId === null}
            onClick={selectInbox}
          />
        </div>

        {/* Folder Tree */}
        <FolderTree folders={folderTree} />
      </nav>
    </>
  )
}
