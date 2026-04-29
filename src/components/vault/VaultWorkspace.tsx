import { useEffect, useMemo } from 'react'
import { ChevronRight, FileText, Folder, FolderOpen, Menu, RefreshCw } from 'lucide-react'

import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import type { VaultDocumentSummary, VaultFolderNode } from '../../core/vault/types'

function getVisibleDocuments(
  documents: VaultDocumentSummary[],
  selectedFolderPath: string | null,
) {
  const targetParent = selectedFolderPath ?? null
  return documents.filter((document) => document.parentPath === targetParent)
}

function formatUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) {
    return 'Date unavailable'
  }

  const timestamp = Number(updatedAt)
  if (Number.isNaN(timestamp)) {
    return updatedAt
  }

  return new Date(timestamp * 1000).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function relativeToRoot(rootPath: string, targetPath: string) {
  if (!targetPath.startsWith(rootPath)) {
    return targetPath
  }

  const relative = targetPath.slice(rootPath.length).replace(/^[/\\]/, '')
  return relative || '.'
}

interface VaultFolderItemProps {
  folder: VaultFolderNode
  depth?: number
}

function VaultFolderItem({ folder, depth = 0 }: VaultFolderItemProps) {
  const {
    selectedFolderId,
    expandedFolders,
    selectFolder,
    toggleFolder,
  } = useNavigationStore()

  const isSelected = selectedFolderId === folder.path
  const isExpanded = expandedFolders.has(folder.path)
  const hasChildren = folder.children.length > 0
  const paddingLeft = 12 + depth * 18

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => selectFolder(folder.path, folder.name)}
        style={{ paddingLeft }}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-stone-100 text-stone-900'
            : 'text-stone-600 hover:bg-stone-100/70 hover:text-stone-900'
        }`}
      >
        {hasChildren ? (
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-md hover:bg-stone-200/80"
            onClick={(event) => {
              event.stopPropagation()
              toggleFolder(folder.path)
            }}
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </span>
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center">
            <Folder className="h-4 w-4 text-stone-400" />
          </span>
        )}

        {hasChildren ? (
          <FolderOpen className={`h-4 w-4 ${isSelected ? 'text-stone-700' : 'text-stone-400'}`} />
        ) : (
          <Folder className={`h-4 w-4 ${isSelected ? 'text-stone-700' : 'text-stone-400'}`} />
        )}

        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        <span className="text-xs text-stone-400">{folder.documentCount}</span>
      </button>

      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-1">
          {folder.children.map((child) => (
            <VaultFolderItem key={child.path} folder={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function VaultWorkspace() {
  const {
    currentVault,
    selectedDocument,
    selectedDocumentPath,
    isReadingDocument,
    selectDocument,
    rescanVault,
    openVault,
  } = useVaultStore()
  const {
    selectedFolderId,
    selectedFolderName,
    sidebarOpen,
    setSidebarOpen,
    selectInbox,
  } = useNavigationStore()

  const visibleDocuments = useMemo(() => {
    if (!currentVault) {
      return []
    }

    return getVisibleDocuments(currentVault.documents, selectedFolderId)
  }, [currentVault, selectedFolderId])

  useEffect(() => {
    if (visibleDocuments.length === 0) {
      void selectDocument(null)
      return
    }

    const activeDocumentStillVisible = visibleDocuments.some(
      (document) => document.path === selectedDocumentPath,
    )

    if (!activeDocumentStillVisible) {
      void selectDocument(visibleDocuments[0].path)
    }
  }, [selectDocument, selectedDocumentPath, visibleDocuments])

  if (!currentVault) {
    return null
  }

  const currentSectionTitle = selectedFolderName ?? currentVault.rootName

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-stone-900/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-stone-200 bg-white transition-transform lg:sticky lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="border-b border-stone-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
              Vault
            </p>
            <h2 className="mt-2 text-lg font-semibold text-stone-900">{currentVault.rootName}</h2>
            <p className="mt-1 text-xs text-stone-500">
              {currentVault.documentCount} indexed documents
            </p>
          </div>

          <div className="border-b border-stone-200 px-4 py-3">
            <button
              type="button"
              onClick={() => selectInbox()}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                selectedFolderId === null
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-600 hover:bg-stone-100/70 hover:text-stone-900'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span className="flex-1">Inbox</span>
              <span className="text-xs text-stone-400">
                {currentVault.documents.filter((document) => document.parentPath === null).length}
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {currentVault.folders.length > 0 ? (
              <div className="flex flex-col gap-1">
                {currentVault.folders.map((folder) => (
                  <VaultFolderItem key={folder.path} folder={folder} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                No subfolders found in this vault.
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/85 px-5 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Current View
                </p>
                <h1 className="text-lg font-semibold text-stone-900">{currentSectionTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void rescanVault()}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900"
              >
                <RefreshCw className="h-4 w-4" />
                Re-scan
              </button>
              <button
                type="button"
                onClick={() => void openVault()}
                className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
              >
                Open another vault
              </button>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <section className="border-b border-stone-200 bg-white xl:border-b-0 xl:border-r">
              <div className="border-b border-stone-200 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Documents
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  {visibleDocuments.length} files in this folder
                </p>
              </div>

              <div className="flex max-h-[calc(100vh-88px-74px)] flex-col overflow-y-auto">
                {visibleDocuments.length === 0 ? (
                  <div className="px-5 py-10 text-sm text-stone-500">
                    No Markdown files directly in this folder.
                  </div>
                ) : (
                  visibleDocuments.map((document) => {
                    const isActive = document.path === selectedDocumentPath

                    return (
                      <button
                        key={document.path}
                        type="button"
                        onClick={() => void selectDocument(document.path)}
                        className={`border-b border-stone-100 px-5 py-4 text-left transition-colors ${
                          isActive ? 'bg-stone-100/80' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 rounded-lg bg-stone-100 p-2 text-stone-500">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-sm font-medium text-stone-900">
                                {document.title}
                              </p>
                              <span className="shrink-0 text-xs text-stone-400">
                                {formatUpdatedAt(document.updatedAt)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-stone-400">
                              {document.name}
                            </p>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">
                              {document.excerpt || 'No excerpt available for this document.'}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            <section className="min-h-0 bg-[linear-gradient(180deg,_rgba(248,244,236,0.95)_0%,_rgba(255,255,255,1)_44%,_rgba(250,248,243,1)_100%)]">
              {isReadingDocument ? (
                <div className="px-8 py-10 text-sm text-stone-500">Loading document...</div>
              ) : selectedDocument ? (
                <article className="mx-auto flex max-w-4xl flex-col px-8 py-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                    Selected File
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                    {selectedDocument.title}
                  </h2>
                  <p className="mt-3 text-sm text-stone-500">
                    {relativeToRoot(currentVault.rootPath, selectedDocument.path)}
                  </p>

                  <div className="mt-8 rounded-[1.75rem] border border-stone-200 bg-white px-6 py-6 shadow-[0_22px_60px_-42px_rgba(58,42,17,0.45)]">
                    <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-stone-700">
                      {selectedDocument.body || selectedDocument.excerpt || 'Empty document.'}
                    </pre>
                  </div>
                </article>
              ) : (
                <div className="px-8 py-10 text-sm text-stone-500">
                  Select a Markdown file from the list to open it.
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
