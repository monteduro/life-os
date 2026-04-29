import { useState } from 'react'
import { formatDate } from '../../lib/utils'
import { useVaultStore } from '../../stores/vaultStore'
import FolderSelector from './FolderSelector'
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
  path,
  folderId,
  title,
  excerpt,
  updatedAt,
  onMove,
  onClick,
}: {
  path: string
  folderId: string | null
  title: string
  excerpt: string
  updatedAt: string
  onMove: (path: string, newFolderId: string | null) => void
  onClick: () => void
}) {
  return (
    <div className="hover-lift w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-white border border-stone-100 shadow-soft hover:border-stone-200 hover:shadow-soft-lg group">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left flex flex-col gap-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
          Markdown
        </span>
        <span className="ml-auto text-xs text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">
          open →
        </span>
        </div>

        <h3 className="text-base font-semibold tracking-tight text-stone-900">
          {title}
        </h3>

        <p className="text-sm text-stone-500 leading-relaxed line-clamp-4">
          {excerpt || <span className="italic text-stone-300">Empty note</span>}
        </p>
      </button>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-50">
        <FolderSelector
          folderId={folderId}
          onChange={(newFolderId) => onMove(path, newFolderId)}
        />
        <span className="text-xs text-stone-300 ml-auto">{formatDate(updatedAt)}</span>
      </div>
    </div>
  )
}

export default function NoteList({ folderId = null }: NoteListProps) {
  const {
    currentVault,
    createDocument,
    moveDocument,
    searchQuery,
    searchResults,
    searchStatus,
    searchError,
  } = useVaultStore()

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
              New note
            </button>
          </div>
          <p className="mt-4 text-sm text-stone-500 leading-6">
            {isSearchActive
              ? `Local search over the SQLite index for “${searchQuery.trim()}”.`
              : 'This is your Inbox. Create notes quickly here without worrying about organizing them yet. When you have spare moments in the day, you can sort them later. Verba volant, scripta manent.'}
          </p>
          {isSearchActive && (
            <div className="mt-4 flex items-center gap-3 text-sm text-stone-500">
              <span>
                {searchStatus === 'searching' && 'Searching…'}
                {searchStatus === 'ready' && `${allNotes.length} results`}
                {searchStatus === 'error' && (searchError ?? 'Search failed')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Latest notes ── */}
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

      {/* ── 3. Archive ── */}
      {archiveNotes.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              Archive
            </span>
            <div className="flex-1 border-t border-stone-200" />
            <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{archiveNotes.length} notes</span>
          </div>

          {/* Expanded note (accordion) — above the grid */}
          {expandedNote && (
            <div className="flex flex-col gap-4 animate-note-expand mb-2">
              <LocalNoteInline summary={expandedNote} onClose={() => setExpandedId(null)} />
            </div>
          )}

          {/* Card grid (excluding the expanded one) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archiveNotes
              .filter((n) => n.path !== expandedId)
              .map((note) => (
                <NotePreviewCard
                  key={note.path}
                  path={note.path}
                  folderId={note.parentPath}
                  title={note.title}
                  excerpt={note.excerpt}
                  updatedAt={normalizeTimestamp(note.updatedAt)}
                  onMove={(path, newFolderId) => {
                    void moveDocument(path, newFolderId)
                  }}
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
          {isSearchActive ? 'No results for this search.' : 'No Markdown notes in this folder.'}
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
