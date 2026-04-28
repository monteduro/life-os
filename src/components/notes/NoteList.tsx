import { useState } from 'react'
import { formatDate } from '../../lib/utils'
import { useVaultStore } from '../../stores/vaultStore'
import LocalNoteInline from './LocalNoteInline'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NoteSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`w-full rounded-2xl bg-stone-100 animate-pulse ${large ? 'h-64' : 'h-36'}`}
    />
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NoteListProps {
  folderId?: string | null  // null = inbox
}

function NotePreviewCard({
  title,
  excerpt,
  updatedAt,
  onClick,
}: {
  title: string
  excerpt: string
  updatedAt: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hover-lift w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-white border border-stone-100 shadow-soft hover:border-stone-200 hover:shadow-soft-lg cursor-pointer group"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
          Markdown
        </span>
        <span className="ml-auto text-xs text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">
          apri →
        </span>
      </div>

      <h3 className="text-base font-semibold tracking-tight text-stone-900">
        {title}
      </h3>

      <p className="text-sm text-stone-500 leading-relaxed line-clamp-4">
        {excerpt || <span className="italic text-stone-300">Nota vuota</span>}
      </p>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-50">
        <span className="text-xs text-stone-300 ml-auto">{formatDate(updatedAt)}</span>
      </div>
    </button>
  )
}

export default function NoteList({ folderId = null }: NoteListProps) {
  const {
    currentVault,
    createDocument,
    searchQuery,
    searchResults,
    searchStatus,
    searchError,
  } = useVaultStore()

  // Quale nota dell'archivio è attualmente espansa (accordion: max 1 alla volta)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!currentVault) {
    return (
      <div className="flex flex-col gap-10">
        <NoteSkeleton large />
        <div className="flex flex-col gap-6">
          <NoteSkeleton large />
          <NoteSkeleton large />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <NoteSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const isSearchActive = searchQuery.trim().length > 0

  const allNotes = [...(isSearchActive ? searchResults : currentVault.documents)]
    .filter((document) => isSearchActive || document.parentPath === folderId)
    .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0))

  const inlineNotes = allNotes.slice(0, 2)   // ultime 2: TipTap sempre caricato
  const archiveNotes = allNotes.slice(2)      // resto: card + espandibile

  const expandedNote = archiveNotes.find((n) => n.path === expandedId) ?? null

  return (
    <div className="flex flex-col gap-0">
      {/* ── 1. Read-only banner ── */}
      <div className="mb-10">
        <div className="flex flex-col p-4 sm:p-6 rounded-[1.25rem] bg-white border border-stone-100 shadow-soft transition-all duration-300">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              Local Vault
            </span>
            <div className="flex-1 border-t border-stone-200 min-w-[96px]" />
            <button
              type="button"
              onClick={async () => {
                const createdDocument = await createDocument(folderId)
                if (createdDocument) {
                  setExpandedId(createdDocument.path)
                }
              }}
              className="text-[0.8125rem] font-medium px-3.5 py-1.5 rounded-lg bg-stone-900 text-stone-50 shadow-sm hover:bg-stone-800 transition-colors"
            >
              Nuova nota
            </button>
          </div>
          <p className="mt-4 text-base text-stone-700 leading-7">
            {isSearchActive
              ? `Ricerca locale sull'indice SQLite per “${searchQuery.trim()}”.`
              : `Questa e\` la tua UI principale riattaccata al vault locale. In questo step la
            navigazione e\` read-only: leggiamo file Markdown reali senza backend e senza
            ancora riattivare il salvataggio TipTap. La creazione file ora passa pero\`
            attraverso il repository locale reale.`}
          </p>
          {isSearchActive && (
            <div className="mt-4 flex items-center gap-3 text-sm text-stone-500">
              <span>
                {searchStatus === 'searching' && 'Ricerca in corso…'}
                {searchStatus === 'ready' && `${allNotes.length} risultati`}
                {searchStatus === 'error' && (searchError ?? 'Ricerca fallita')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Ultime 2 note ── */}
      {inlineNotes.length > 0 && (
        <div className="mb-10 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              Latest
            </span>
            <div className="flex-1 border-t border-stone-200" />
          </div>
          {inlineNotes.map((note) => (
            <LocalNoteInline key={note.path} summary={note} />
          ))}
        </div>
      )}

      {/* ── 3. Archivio ── */}
      {archiveNotes.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              Archivio
            </span>
            <div className="flex-1 border-t border-stone-200" />
            <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{archiveNotes.length} note</span>
          </div>

          {/* Nota espansa (accordion) — sopra la grid */}
          {expandedNote && (
            <div className="flex flex-col gap-4 animate-note-expand mb-2">
              <LocalNoteInline summary={expandedNote} onClose={() => setExpandedId(null)} />
            </div>
          )}

          {/* Grid delle card (esclusa quella espansa) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archiveNotes
              .filter((n) => n.path !== expandedId)
              .map((note) => (
                <NotePreviewCard
                  key={note.path}
                  title={note.title}
                  excerpt={note.excerpt}
                  updatedAt={normalizeTimestamp(note.updatedAt)}
                  onClick={() => {
                    setExpandedId(note.path)
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {allNotes.length === 0 && (
        <p className="text-sm text-stone-400 italic py-4">
          {isSearchActive ? 'Nessun risultato per questa ricerca.' : 'Nessuna nota Markdown in questa cartella.'}
        </p>
      )}
    </div>
  )
}

function normalizeTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return new Date(0).toISOString()
  }

  const numericTimestamp = Number(timestamp)
  if (Number.isNaN(numericTimestamp)) {
    return new Date(0).toISOString()
  }

  return new Date(numericTimestamp * 1000).toISOString()
}
