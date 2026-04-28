import { useEffect } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'

import { useVaultStore } from '../../stores/vaultStore'
import VaultWorkspace from './VaultWorkspace'

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

  useEffect(() => {
    void loadRecentVault()
  }, [loadRecentVault])

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
              Apri una cartella locale e trattala come database nativo di note Markdown.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
              Questo primo slice sposta l&apos;app su desktop, legge cartelle e file `.md`
              reali e popola una sidebar basata sul filesystem. L&apos;editor TipTap e il layer
              template restano i prossimi step sopra questa base.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  clearError()
                  void openVault()
                }}
                disabled={status === 'loading'}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FolderOpen className="h-4 w-4" />
                {status === 'loading' ? 'Apertura vault…' : 'Apri cartella'}
              </button>

              <span className="text-sm text-stone-500">
                Avvia da desktop con `npm run tauri:dev`.
              </span>
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>

          <aside className="rounded-[2rem] border border-stone-200/70 bg-stone-950 p-8 text-stone-50 shadow-[0_30px_80px_-45px_rgba(16,10,2,0.8)]">
            <div className="flex items-center gap-3 text-sm text-stone-300">
              <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
              {status === 'loading' ? 'Indicizzazione iniziale in corso' : 'Stato attuale'}
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Step attivo</p>
                <p className="mt-2 text-lg font-medium text-white">
                  Vault bootstrap + scan filesystem
                </p>
              </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Cosa c’è già</p>
              <ul className="mt-3 space-y-2 text-sm text-stone-200">
                <li>Selezione cartella locale</li>
                <li>Scan ricorsivo di cartelle e file `.md`</li>
                <li>Sidebar guidata dal filesystem</li>
                <li>Preview documenti in lettura</li>
                <li>Indice SQLite locale iniziale</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Indice locale</p>
              <div className="mt-3 space-y-2 text-sm text-stone-200">
                <p>
                  {indexStatus === 'indexing' && 'Indicizzazione SQLite in corso…'}
                  {indexStatus === 'ready' && currentIndex && `${currentIndex.indexedDocuments} documenti e ${currentIndex.indexedFolders} cartelle indicizzati`}
                  {indexStatus === 'error' && (indexError ?? 'Indicizzazione SQLite fallita')}
                  {indexStatus === 'idle' && 'Indice non ancora avviato'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Step successivi</p>
              <ul className="mt-3 space-y-2 text-sm text-stone-200">
                <li>Ricerca e query sopra l’indice</li>
                <li>Watcher e re-index incrementale</li>
                <li>Rename/move in-app</li>
                <li>Template esterni al vault</li>
              </ul>
            </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
