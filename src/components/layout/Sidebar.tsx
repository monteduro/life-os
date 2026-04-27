import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import { mapVaultFoldersToAppFolders } from '../../core/vault/adapters'
import { getIcon } from '../../lib/iconMap'
import SidebarNavItem from './SidebarNavItem'
import FolderTree from './FolderTree'
import type { Folder } from '../../types'

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { currentVault } = useVaultStore()

  const { selectedFolderId, sidebarOpen, selectInbox } = useNavigationStore()

  const folderTree = currentVault ? mapVaultFoldersToAppFolders(currentVault.folders) : []

  const inboxCount = currentVault
    ? currentVault.documents.filter((document) => document.parentPath === null).length
    : 0

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
        />
      </aside>
    </>
  )
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────

interface SidebarContentProps {
  folderTree: Folder[]
  inboxCount: number
  selectedFolderId: string | null
  selectInbox: () => void
}

function SidebarContent({
  folderTree,
  inboxCount,
  selectedFolderId,
  selectInbox,
}: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div
        className="px-6 flex items-center border-b border-stone-100 shrink-0"
        style={{ height: 'var(--navbar-height)' }}
      >
        <span className="text-base font-semibold text-stone-800 tracking-tight">
          smart<span className="text-stone-400 font-normal">notes</span>
        </span>
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
