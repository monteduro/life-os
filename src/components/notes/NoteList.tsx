import { useMemo, useState, type ReactNode } from 'react'
import { formatDate } from '../../lib/utils'
import { useVaultStore } from '../../stores/vaultStore'
import FolderSelector from './FolderSelector'
import LocalNoteInline from './LocalNoteInline'
import type { VaultDocumentSummary } from '../../core/vault/types'

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
  view?: 'inbox' | 'folder' | 'upcoming'
}

const UPCOMING_COMPLETED_FILTERS_KEY = 'life-os.upcoming.show-completed-groups'

function loadUpcomingCompletedFilters() {
  try {
    const raw = localStorage.getItem(UPCOMING_COMPLETED_FILTERS_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, boolean>
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function persistUpcomingCompletedFilters(filters: Record<string, boolean>) {
  try {
    localStorage.setItem(UPCOMING_COMPLETED_FILTERS_KEY, JSON.stringify(filters))
  } catch {
    // Ignore storage errors: this is a best-effort UI preference.
  }
}

function getReminderTone(note: VaultDocumentSummary): 'default' | 'overdue' | 'completed' {
  if (note.completedAt) {
    return 'completed'
  }

  if (isPastDue(note.dueDate)) {
    return 'overdue'
  }

  return 'default'
}

function renderReminderCompletionControl(
  note: VaultDocumentSummary,
  onComplete: (path: string, completed: boolean) => void,
  tone: 'default' | 'overdue' | 'completed' = 'default',
) {
  if (!note.dueDate) {
    return null
  }

  return (
    <label className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${
      note.completedAt
        ? 'bg-emerald-100 text-emerald-700'
        : tone === 'overdue'
          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
    }`}>
      <input
        type="checkbox"
        className="h-3.5 w-3.5 rounded border-stone-300 text-stone-900 focus:ring-stone-400"
        checked={!!note.completedAt}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          onComplete(note.path, event.target.checked)
        }}
      />
      <span>Done</span>
    </label>
  )
}

function NotePreviewCard({
  path,
  folderId,
  title,
  excerpt,
  updatedAt,
  dueDate,
  tone = 'default',
  completionControl,
  onMove,
  onClick,
}: {
  path: string
  folderId: string | null
  title: string
  excerpt: string
  updatedAt: string
  dueDate: string | null
  tone?: 'default' | 'overdue' | 'completed'
  completionControl?: ReactNode
  onMove: (path: string, newFolderId: string | null) => void
  onClick: () => void
}) {
  return (
    <div
      className={`hover-lift w-full text-left flex flex-col gap-3 p-5 rounded-2xl border shadow-soft hover:shadow-soft-lg group ${
        tone === 'completed'
          ? 'bg-emerald-50/70 border-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_-18px_-18px_42px_rgba(16,185,129,0.12),0_4px_20px_0_rgb(0_0_0_/_0.05)] hover:border-emerald-200'
          : tone === 'overdue'
            ? 'bg-rose-50/70 border-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_-18px_-18px_42px_rgba(244,63,94,0.10),0_4px_20px_0_rgb(0_0_0_/_0.05)] hover:border-rose-200'
          : 'bg-white border-stone-100 hover:border-stone-200'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left flex flex-col gap-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {completionControl}
          <span className="ml-auto text-xs text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">
            open →
          </span>
        </div>

        <h3 className={`text-base font-semibold tracking-tight ${
          tone === 'completed' ? 'text-emerald-950' : tone === 'overdue' ? 'text-rose-950' : 'text-stone-900'
        }`}>
          {title}
        </h3>

        <p className={`text-sm leading-relaxed line-clamp-4 ${
          tone === 'completed' ? 'text-emerald-800/75' : tone === 'overdue' ? 'text-rose-800/75' : 'text-stone-500'
        }`}>
          {excerpt || <span className="italic text-stone-300">Empty note</span>}
        </p>
      </button>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-50">
        <div className="flex items-center gap-2">
          <FolderSelector
            folderId={folderId}
            onChange={(newFolderId) => onMove(path, newFolderId)}
          />
          {dueDate && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              tone === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : tone === 'overdue'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-50 text-amber-700'
            }`}>
              {formatReminderDate(dueDate)}
            </span>
          )}
        </div>
        <span className="text-xs text-stone-300 ml-auto">{formatDate(updatedAt)}</span>
      </div>
    </div>
  )
}

export default function NoteList({ folderId = null, view = 'inbox' }: NoteListProps) {
  const {
    currentVault,
    createDocument,
    moveDocument,
    setReminderCompleted,
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

  if (view === 'upcoming' && !isSearchActive) {
    return (
      <UpcomingNoteList
        notes={currentVault.documents}
        onMove={moveDocument}
        onComplete={setReminderCompleted}
        expandedId={expandedId}
        onExpand={setExpandedId}
      />
    )
  }

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
            <LocalNoteInline
              key={note.path}
              summary={note}
              reminderTone={getReminderTone(note)}
              reminderCompletionControl={renderReminderCompletionControl(
                note,
                (path, completed) => { void setReminderCompleted(path, completed) },
                getReminderTone(note),
              )}
            />
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
              <LocalNoteInline
                summary={expandedNote}
                onClose={() => setExpandedId(null)}
                reminderTone={getReminderTone(expandedNote)}
                reminderCompletionControl={renderReminderCompletionControl(
                  expandedNote,
                  (path, completed) => { void setReminderCompleted(path, completed) },
                  getReminderTone(expandedNote),
                )}
              />
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
                  dueDate={note.dueDate}
                  tone={getReminderTone(note)}
                  completionControl={renderReminderCompletionControl(
                    note,
                    (path, completed) => { void setReminderCompleted(path, completed) },
                    getReminderTone(note),
                  )}
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

function UpcomingNoteList({
  notes,
  onMove,
  onComplete,
  expandedId,
  onExpand,
}: {
  notes: VaultDocumentSummary[]
  onMove: (path: string, newFolderId: string | null) => Promise<unknown>
  onComplete: (path: string, completed: boolean) => Promise<unknown>
  expandedId: string | null
  onExpand: (path: string | null) => void
}) {
  const datedNotes = notes
    .filter((note) => !!note.dueDate)
    .sort((left, right) => new Date(left.dueDate ?? 0).getTime() - new Date(right.dueDate ?? 0).getTime())

  const [visibleCompletedGroups, setVisibleCompletedGroups] = useState<Record<string, boolean>>(
    () => loadUpcomingCompletedFilters(),
  )

  const groups = useMemo(() => {
    const baseGroups = [
      { key: 'overdue', title: 'Overdue', notes: datedNotes.filter((note) => isPastDue(note.dueDate)) },
      { key: 'today', title: 'Today', notes: datedNotes.filter((note) => isToday(note.dueDate)) },
      { key: 'later', title: 'Later', notes: datedNotes.filter((note) => !isPastDue(note.dueDate) && !isToday(note.dueDate)) },
    ]

    return baseGroups
      .map((group) => {
        const activeNotes = group.notes.filter((note) => !note.completedAt)
        const completedNotes = group.notes.filter((note) => !!note.completedAt)
        const showCompleted = visibleCompletedGroups[group.key] ?? false
        const visibleNotes = showCompleted ? [...activeNotes, ...completedNotes] : activeNotes

        return {
          ...group,
          activeNotes,
          completedNotes,
          showCompleted,
          visibleNotes,
        }
      })
      .filter((group) => group.visibleNotes.length > 0 || group.completedNotes.length > 0)
  }, [datedNotes, visibleCompletedGroups])
  const expandedNote = datedNotes.find((note) => note.path === expandedId) ?? null

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col p-4 sm:p-6 rounded-[1.25rem] bg-white border border-stone-100 shadow-soft transition-all duration-300">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
            Upcoming
          </span>
          <div className="flex-1 border-t border-stone-200 min-w-[96px]" />
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
            {datedNotes.filter((note) => !note.completedAt).length} reminders
          </span>
        </div>
        <p className="mt-4 text-sm text-stone-500 leading-6">
          Notes with a persisted due date or reminder. This is the first step toward calendar-oriented views.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-4">
          No upcoming reminders yet.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
                {group.title}
              </span>
              <div className="flex-1 border-t border-stone-200" />
              {group.completedNotes.length > 0 && (
                <label className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                    checked={group.showCompleted}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setVisibleCompletedGroups((current) => {
                        const next = {
                          ...current,
                          [group.key]: checked,
                        }
                        persistUpcomingCompletedFilters(next)
                        return next
                      })
                    }}
                  />
                  <span>Show completed</span>
                </label>
              )}
              <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                {group.visibleNotes.length} notes
              </span>
            </div>

            {expandedNote && group.visibleNotes.some((note) => note.path === expandedNote.path) && (
              <div className="flex flex-col gap-4 animate-note-expand mb-2">
                <LocalNoteInline
                  summary={expandedNote}
                  onClose={() => onExpand(null)}
                  reminderTone={getReminderTone(expandedNote)}
                  reminderCompletionControl={
                    expandedNote.dueDate ? (
                      renderReminderCompletionControl(
                        expandedNote,
                        (path, completed) => { void onComplete(path, completed) },
                        getReminderTone(expandedNote),
                      )
                    ) : null
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.visibleNotes
                .filter((note) => note.path !== expandedId)
                .map((note) => (
                  <NotePreviewCard
                    key={note.path}
                    path={note.path}
                    folderId={note.parentPath}
                    title={note.title}
                    excerpt={note.excerpt}
                    updatedAt={normalizeTimestamp(note.updatedAt)}
                    dueDate={note.dueDate}
                    tone={getReminderTone(note)}
                    completionControl={renderReminderCompletionControl(
                      note,
                      (path, completed) => { void onComplete(path, completed) },
                      getReminderTone(note),
                    )}
                    onMove={(path, newFolderId) => {
                      void onMove(path, newFolderId)
                    }}
                    onClick={() => {
                      onExpand(note.path)
                    }}
                  />
                ))}
            </div>
          </div>
        ))
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

function formatReminderDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isPastDue(iso: string | null) {
  if (!iso) return false
  const date = startOfDay(new Date(iso))
  const today = startOfDay(new Date())
  return !Number.isNaN(date.getTime()) && date.getTime() < today.getTime()
}

function isToday(iso: string | null) {
  if (!iso) return false
  const date = new Date(iso)
  const now = new Date()
  return (
    !Number.isNaN(date.getTime())
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  )
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
