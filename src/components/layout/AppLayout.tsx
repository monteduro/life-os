import { useEffect, useMemo, useState } from 'react'
import { Pencil, Search } from 'lucide-react'

import type { FolderNode } from '../../core/domain/storage'
import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import TextPromptDialog from '../Form/TextPromptDialog'
import Sidebar from './Sidebar'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: AppLayoutProps) {
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const { sidebarOpen, setSidebarOpen, selectedFolderId, selectedFolderName, selectFolder } = useNavigationStore()
  const {
    currentVault,
    openVault,
    renameFolder,
    rescanVault,
    status,
    searchQuery,
    searchStatus,
    setSearchQuery,
    runSearch,
  } = useVaultStore()
  const currentTitle = searchQuery.trim()
    ? 'Search'
    : selectedFolderName ?? currentVault?.rootName ?? 'Vault'
  const selectedFolderNode = useMemo(
    () => (currentVault && selectedFolderId ? findFolderNode(currentVault.folders, selectedFolderId) : null),
    [currentVault, selectedFolderId],
  )
  const canRenameSelectedFolder = !searchQuery.trim() && !!selectedFolderNode

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery)
    }, 180)

    return () => window.clearTimeout(handle)
  }, [runSearch, searchQuery])

  const handleRenameFolder = async (nextName: string) => {
    if (!selectedFolderNode) {
      return
    }

    const renamedPath = await renameFolder(selectedFolderNode.path, nextName)
    if (!renamedPath) {
      return
    }

    selectFolder(renamedPath, nextName)
    setRenameFolderOpen(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-stone-900/20 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-stone-100 px-6 flex items-center justify-between gap-4"
          style={{ height: 'var(--navbar-height)' }}
        >
          {/* Mobile: hamburger */}
          <button
            className="lg:hidden text-stone-600 hover:text-stone-900 p-2 -ml-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Active view title */}
          <div className="lg:ml-0 ml-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="block text-lg font-semibold text-stone-800 tracking-tight truncate">
                {currentTitle}
              </span>
              {canRenameSelectedFolder && (
                <button
                  type="button"
                  onClick={() => setRenameFolderOpen(true)}
                  className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  aria-label="Rename folder"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {currentVault && (
              <span className="hidden sm:block text-xs text-stone-400 truncate">
                {currentVault.rootName}
              </span>
            )}
          </div>

          <div className="hidden md:flex flex-1 max-w-xl">
            <label className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notes…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-24 text-sm text-stone-700 outline-none transition-colors focus:border-stone-300 focus:bg-white"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
                {searchStatus === 'searching' ? 'searching' : 'local'}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void rescanVault()}
              disabled={status === 'loading'}
              className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-50 transition-colors"
            >
              {status === 'loading' ? 'Re-scan…' : 'Re-scan'}
            </button>
            <button
              onClick={() => void openVault()}
              className="text-xs text-stone-400 hover:text-stone-800 transition-colors"
            >
              Apri altra cartella
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-10">{children}</main>
      </div>

      <TextPromptDialog
        open={renameFolderOpen}
        title="Rename folder"
        description="Update the folder name on disk."
        placeholder="Folder name"
        initialValue={selectedFolderNode?.name ?? ''}
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onCancel={() => setRenameFolderOpen(false)}
        onConfirm={handleRenameFolder}
      />
    </div>
  )
}

function findFolderNode(nodes: FolderNode[], targetPath: string): FolderNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node
    }

    const nested = findFolderNode(node.children, targetPath)
    if (nested) {
      return nested
    }
  }

  return null
}
