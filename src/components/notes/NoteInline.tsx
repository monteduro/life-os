import { useState, useCallback, useEffect } from 'react'
import { useCreateNote, useUpdateNote, useDeleteNote, type Note, type TipTapDocument } from '../../api/notesApi'
import { useCurrentUser } from '../../api/authApi'
import NoteEditor from '../editor/NoteEditor'
import FolderSelector from './FolderSelector'
import { formatDate } from '../../lib/utils'
import type { DetectedDate } from '../../extensions/date-detection-extension'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_DOC: TipTapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

const DRAFT_KEY = 'note-create-draft'

interface StoredDraft {
  content: TipTapDocument
  contentPlain: string
  detectedDate: DetectedDate | null
}

function loadDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as StoredDraft) : null
  } catch {
    return null
  }
}

function saveDraftToStorage(draft: StoredDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch { /* quota exceeded o simili: ignora */ }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

// ─── Variante CREAZIONE ───────────────────────────────────────────────────────

interface NoteCreateFormProps {
  folderId?: string | null  // null = inbox
}

function NoteCreateForm({ folderId = null }: NoteCreateFormProps) {
  const { data: user } = useCurrentUser()
  const { mutate: createNote, isPending } = useCreateNote()

  const [draft] = useState<StoredDraft | null>(() => loadDraft())
  const [content, setContent] = useState<TipTapDocument | null>(draft?.content ?? null)
  const [contentPlain, setContentPlain] = useState(draft?.contentPlain ?? '')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId)
  const [editorKey, setEditorKey] = useState(0)
  const [detectedDate, setDetectedDate] = useState<DetectedDate | null>(draft?.detectedDate ?? null)

  const handleEditorChange = useCallback((doc: TipTapDocument, plain: string) => {
    setContent(doc)
    setContentPlain(plain)
  }, [])

  const handleDateDetected = useCallback((date: DetectedDate | null) => {
    setDetectedDate(date)
  }, [])

  // Persisti in localStorage con debounce (1s) per non scrivere ad ogni tasto
  useEffect(() => {
    if (!contentPlain.trim()) return
    const timer = setTimeout(() => {
      saveDraftToStorage({ content: content ?? EMPTY_DOC, contentPlain, detectedDate })
    }, 1000)
    return () => clearTimeout(timer)
  }, [content, contentPlain, detectedDate])

  const reset = () => {
    clearDraft()
    setContent(null)
    setContentPlain('')
    setDetectedDate(null)
    setEditorKey((k) => k + 1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!contentPlain.trim()) return
    createNote(
      {
        content: content ?? EMPTY_DOC,
        content_plain: contentPlain,
        folder_id: selectedFolderId,
        due_date: detectedDate?.iso ?? null,
        due_date_raw: detectedDate?.raw ?? null,
      },
      { onSuccess: reset },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col p-4 sm:p-6 rounded-[1.25rem] bg-white border border-stone-100 shadow-soft transition-all duration-300"
    >
      <NoteEditor
        content={content ?? undefined}
        onChange={handleEditorChange}
        onDateDetected={handleDateDetected}
        editorKey={editorKey}
        placeholder="Scrivi la tua nota… (Markdown supportato)"
        autofocus
        lang={user?.lang}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-2 border-t border-stone-100">
        <div className="flex items-center gap-2 flex-wrap">
          <FolderSelector
            folderId={selectedFolderId}
            onChange={setSelectedFolderId}
          />
          {detectedDate && (
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              📅 {detectedDate.raw} → {new Date(detectedDate.iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap ml-auto">
          {contentPlain && (
            <button
              type="button"
              onClick={reset}
              className="text-[0.8125rem] font-medium px-3.5 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={isPending || !contentPlain.trim()}
            className="text-[0.8125rem] font-medium px-4 py-[0.45rem] rounded-lg bg-stone-900 text-stone-50 shadow-sm hover-lift-sm hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isPending ? 'Salvataggio…' : <><span>Save</span><span>↓</span></>}
          </button>
        </div>
      </div>
    </form>
  )
}

// ─── Variante MODIFICA ────────────────────────────────────────────────────────

interface NoteEditFormProps {
  note: Note
  onClose?: () => void
}

function NoteEditForm({ note, onClose }: NoteEditFormProps) {
  const { data: user } = useCurrentUser()
  const { mutate: updateNote, mutateAsync: updateNoteAsync, isPending: isSaving } = useUpdateNote(note.id)
  const { mutate: deleteNote, isPending: isDeleting } = useDeleteNote()

  const [content, setContent] = useState<TipTapDocument>(note.content)
  const [contentPlain, setContentPlain] = useState(note.content_plain)
  const [isDirty, setIsDirty] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [editorKey] = useState(() => note.id)
  const [detectedDate, setDetectedDate] = useState<DetectedDate | null>(
    note.due_date && note.due_date_raw ? { iso: note.due_date, raw: note.due_date_raw } : null,
  )

  const handleEditorChange = useCallback((doc: TipTapDocument, plain: string) => {
    setContent(doc)
    setContentPlain(plain)
    setIsDirty(true)
  }, [])

  const handleDateDetected = useCallback((date: DetectedDate | null) => {
    setDetectedDate(date)
  }, [])

  const handleSave = () => {
    updateNote(
      {
        content,
        content_plain: contentPlain,
        due_date: detectedDate?.iso ?? null,
        due_date_raw: detectedDate?.raw ?? null,
      },
      { onSuccess: () => setIsDirty(false) },
    )
  }

  const handleDelete = () => {
    deleteNote(note.id, { onSuccess: () => onClose?.() })
  }

  return (
    <div
      className={`group flex flex-col p-4 sm:p-6 rounded-[1.25rem] bg-white border transition-colors duration-300 ${isDirty
        ? 'border-stone-300 shadow-soft'
        : 'hover-lift border-stone-100 shadow-soft hover:border-stone-200 hover:shadow-soft-lg'
        }`}
    >
      {/* Editor */}
      <NoteEditor
        key={editorKey}
        content={note.content}
        onChange={handleEditorChange}
        onDateDetected={handleDateDetected}
        onSave={handleSave}
        onBeforeNavigate={async () => {
          if (isDirty && updateNoteAsync) {
            await updateNoteAsync({
              content,
              content_plain: contentPlain,
              due_date: detectedDate?.iso ?? null,
              due_date_raw: detectedDate?.raw ?? null,
            })
            setIsDirty(false)
          }
        }}
        placeholder="Contenuto nota…"
        preferredDateRaw={note.due_date_raw ?? undefined}
        lang={user?.lang}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-2 border-t border-stone-100">
        {/* Meta info sulla sinistra */}
        <div className="flex items-center gap-2 flex-wrap">
          <FolderSelector
            folderId={note.folder_id}
            onChange={async (newFolderId) => {
              if (updateNoteAsync) {
                await updateNoteAsync({ folder_id: newFolderId })
              } else {
                updateNote({ folder_id: newFolderId })
              }
            }}
          />
          {detectedDate && (
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              📅 {detectedDate.raw} → {new Date(detectedDate.iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span className="text-xs text-stone-400 ml-1">{formatDate(note.updated_at)}</span>
        </div>

        {/* Actions sulla destra */}
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          {/* Sezione Elimina */}
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[0.8125rem] text-stone-500 mr-1">Eliminare?</span>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-[0.8125rem] font-semibold px-4 py-1.5 rounded-lg bg-red-100 text-red-600 hover-lift-sm hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? '...' : 'Sì'}
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                Elimina
              </button>
            </div>
          )}

          {/* Salva / Annulla modifiche */}
          {isDirty && (
            <div className="flex items-center gap-1 ml-2 border-l border-stone-100 pl-3">
              <button
                type="button"
                onClick={() => setIsDirty(false)}
                className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="text-[0.8125rem] font-medium px-4 py-[0.45rem] rounded-lg bg-stone-900 text-stone-50 shadow-sm hover-lift-sm hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          )}

          {/* Chiudi accordion archivio */}
          {onClose && (
            <button
              onClick={onClose}
              className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 ml-2 border-l border-stone-100 pl-4 transition-colors"
            >
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Export pubblico ──────────────────────────────────────────────────────────

interface NoteInlineProps {
  note?: Note
  onClose?: () => void
  folderId?: string | null  // null = inbox

}

export default function NoteInline({ note, onClose, folderId = null }: NoteInlineProps) {
  if (!note) return <NoteCreateForm folderId={folderId} />
  return <NoteEditForm note={note} onClose={onClose} />
}
