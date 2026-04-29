import { useEffect } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'

import { useVaultStore } from '../../stores/vaultStore'
import VaultWorkspace from './VaultWorkspace'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

export default function VaultBootstrap() {
  const {
    status,
    indexStatus,
    indexError,
    currentIndex,
    error,
    currentVault,
    loadRecentVault,
    openVault,
    clearError,
  } = useVaultStore()
  const hasDesktopShell = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

  useEffect(() => {
    if (!hasDesktopShell) {
      return
    }

    void loadRecentVault()
  }, [hasDesktopShell, loadRecentVault])

  if (status === 'ready' && currentVault) {
    return <VaultWorkspace />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(215,197,166,0.35),_transparent_32%),linear-gradient(180deg,_#f8f4ec_0%,_#f5f1e8_48%,_#efe9dd_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-stone-200/70 bg-white/85 p-8 shadow-[0_30px_80px_-40px_rgba(58,42,17,0.45)] backdrop-blur">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Desktop Vault
            </p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              Open a local folder and treat it as a native database of Markdown notes.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
              lifeOS currently relies on the Tauri desktop shell for vault access, local
              indexing, file watching, and in-app document operations. The plain Vite browser
              preview is useful only for frontend iteration, not as a working product runtime.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  clearError()
                  void openVault()
                }}
                disabled={status === 'loading' || !hasDesktopShell}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FolderOpen className="h-4 w-4" />
                {!hasDesktopShell
                  ? 'Desktop shell required'
                  : status === 'loading'
                    ? 'Opening vault...'
                    : 'Open folder'}
              </button>

              <span className="text-sm text-stone-500">
                Start the full app with `npm run tauri:dev`.
              </span>
            </div>

            {!hasDesktopShell && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The browser preview cannot open or manage a vault. Use it only to iterate on
                styling and static UI states.
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>

          <aside className="rounded-[2rem] border border-stone-200/70 bg-stone-950 p-8 text-stone-50 shadow-[0_30px_80px_-45px_rgba(16,10,2,0.8)]">
            <div className="flex items-center gap-3 text-sm text-stone-300">
              <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
              {status === 'loading' ? 'Initial indexing in progress' : 'Current state'}
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Active step</p>
                <p className="mt-2 text-lg font-medium text-white">
                  Vault bootstrap + filesystem scan
                </p>
              </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Already implemented</p>
              <ul className="mt-3 space-y-2 text-sm text-stone-200">
                <li>Local folder selection</li>
                <li>Recursive scan of folders and `.md` files</li>
                <li>Filesystem-driven sidebar</li>
                <li>Read-only document previews</li>
                <li>Initial local SQLite index</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Local index</p>
              <div className="mt-3 space-y-2 text-sm text-stone-200">
                <p>
                  {indexStatus === 'indexing' && 'SQLite indexing in progress...'}
                  {indexStatus === 'ready' && currentIndex && `${currentIndex.indexedDocuments} documents and ${currentIndex.indexedFolders} folders indexed`}
                  {indexStatus === 'error' && (indexError ?? 'SQLite indexing failed')}
                  {indexStatus === 'idle' && 'Index not started yet'}
                </p>
                {currentIndex?.databaseExists && currentIndex.indexedAt && (
                  <p className="text-xs text-stone-400">
                    Last rebuild: {new Date(Number(currentIndex.indexedAt) * 1000).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Next steps</p>
              <ul className="mt-3 space-y-2 text-sm text-stone-200">
                <li>Search and queries on top of the index</li>
                <li>Watcher and incremental re-indexing</li>
                <li>In-app rename/move flows</li>
                <li>Templates outside the vault</li>
              </ul>
            </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
