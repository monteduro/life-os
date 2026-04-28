import { useEffect, useMemo, useState } from 'react'
import { FolderInput, Folders, Pencil, RefreshCw, Search } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { MouseEvent as ReactMouseEvent } from 'react'

import type { FolderNode } from '../../core/domain/storage'
import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import FolderMoveDialog from '../Form/FolderMoveDialog'
import TextPromptDialog from '../Form/TextPromptDialog'
import Tooltip from '../ui/Tooltip'
import Sidebar from './Sidebar'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: AppLayoutProps) {
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [moveFolderOpen, setMoveFolderOpen] = useState(false)
  const { sidebarOpen, setSidebarOpen, selectedFolderId, selectedFolderName, selectFolder } = useNavigationStore()
  const {
    currentVault,
    moveFolder,
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
    : selectedFolderName ?? 'Inbox'
  const selectedFolderNode = useMemo(
    () => (currentVault && selectedFolderId ? findFolderNode(currentVault.folders, selectedFolderId) : null),
    [currentVault, selectedFolderId],
  )
  const canRenameSelectedFolder = !searchQuery.trim() && !!selectedFolderNode
  const [isOverlayCompact, setIsOverlayCompact] = useState(false)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery)
    }, 180)

    return () => window.clearTimeout(handle)
  }, [runSearch, searchQuery])

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      document.documentElement.style.setProperty('--titlebar-inset-current', '0px')
      return
    }

    const appWindow = getCurrentWindow()
    let disposed = false

    const syncWindowChrome = async () => {
      const [fullscreen, maximized] = await Promise.all([
        appWindow.isFullscreen(),
        appWindow.isMaximized(),
      ])

      if (disposed) {
        return
      }

      const compact = fullscreen || maximized
      setIsOverlayCompact(compact)
      document.documentElement.style.setProperty('--titlebar-inset-current', compact ? '0px' : '28px')
    }

    void syncWindowChrome()

    let unlisten: (() => void) | undefined

    void appWindow.onResized(() => {
      void syncWindowChrome()
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

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

  const handleMoveFolder = async (targetParentPath: string | null) => {
    if (!selectedFolderNode) {
      return
    }

    const movedPath = await moveFolder(selectedFolderNode.path, targetParentPath)
    if (!movedPath) {
      return
    }

    selectFolder(movedPath, selectedFolderNode.name)
    setMoveFolderOpen(false)
  }

  const startWindowDrag = () => {
    if (!('__TAURI_INTERNALS__' in window)) {
      return
    }

    void getCurrentWindow().startDragging()
  }

  const handleWindowDragMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement | null
    if (target?.closest('button, input, textarea, select, a, [role="button"], [data-no-window-drag]')) {
      return
    }

    startWindowDrag()
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
        <header className="sticky top-0 z-20">
          <div
            className="border-b border-stone-100 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/75"
            onMouseDown={handleWindowDragMouseDown}
          >
            <div
              data-tauri-drag-region
              onMouseDown={startWindowDrag}
              className={isOverlayCompact ? 'hidden' : 'block'}
              style={{ height: 'var(--titlebar-inset-current)' }}
            />
            <div
              data-tauri-drag-region
              className="mx-auto flex w-full max-w-5xl items-center justify-between gap-5 px-6"
              style={{ height: 'var(--app-header-height)' }}
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
          <div className="lg:ml-0 ml-2 min-w-0 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="block text-lg font-semibold text-stone-800 tracking-tight truncate">
                {currentTitle}
              </span>
              {canRenameSelectedFolder && (
                <>
                  <Tooltip content="Move folder">
                    <button
                      type="button"
                      onClick={() => setMoveFolderOpen(true)}
                      className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Move folder"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Rename folder">
                    <button
                      type="button"
                      onClick={() => setRenameFolderOpen(true)}
                      className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Rename folder"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
          </div>

          <div className="hidden md:flex min-w-0 flex-1">
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
                className="w-full rounded-xl bg-stone-50 py-2.5 pl-9 pr-24 text-sm text-stone-700 outline-none ring-1 ring-stone-200 transition-colors focus:bg-white focus:ring-stone-300"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
                {searchStatus === 'searching' ? 'searching' : 'local'}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Tooltip content="Sync vault">
              <button
                onClick={() => void rescanVault()}
                disabled={status === 'loading'}
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50 transition-colors"
                aria-label="Sync vault"
              >
                <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
            <Tooltip content="Change vault">
              <button
                onClick={() => void openVault()}
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                aria-label="Change vault"
              >
                <Folders className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10">{children}</main>
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

      <FolderMoveDialog
        open={moveFolderOpen && !!selectedFolderNode}
        currentFolderId={selectedFolderNode?.path ?? ''}
        currentFolderName={selectedFolderNode?.name ?? ''}
        targetParentId={selectedFolderNode?.parentPath ?? null}
        onCancel={() => setMoveFolderOpen(false)}
        onConfirm={handleMoveFolder}
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
