import { useCallback, useEffect, useMemo, useState } from 'react'

import NoteEditor from '../editor/NoteEditor'
import TextPromptDialog from '../Form/TextPromptDialog'
import { activeDocumentRepository } from '../../core/storage/activeStorage'
import { formatDate } from '../../lib/utils'
import { useVaultStore } from '../../stores/vaultStore'
import FolderSelector from './FolderSelector'
import { parseDates } from '../../lib/chrono-it'
import {
  markdownToTipTapDocument,
  mergeRawVaultDocument,
  readDateFrontmatter,
  splitRawVaultDocument,
  tipTapDocumentToMarkdown,
  updateDateFrontmatter,
} from '../../core/vault/markdownDocument'
import type { TipTapDocument } from '../../types'
import type { VaultDocumentSummary } from '../../core/vault/types'
import type { DetectedDate } from '../../extensions/date-detection-extension'

interface LocalNoteInlineProps {
  summary: VaultDocumentSummary
  onClose?: () => void
}

const EMPTY_DOC: TipTapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

const DRAFT_STORAGE_PREFIX = 'life-os.local-note-draft:'

interface StoredLocalDraft {
  editorDocument: TipTapDocument
  pendingFolderId: string | null
  pendingFileName: string
  detectedDate: DetectedDate | null
  dismissedDateRaws: string[]
}

type DateSelectionMode = 'auto' | 'manual' | null

function getDraftStorageKey(path: string) {
  return `${DRAFT_STORAGE_PREFIX}${path}`
}

function loadDraft(path: string): StoredLocalDraft | null {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(path))
    return raw ? (JSON.parse(raw) as StoredLocalDraft) : null
  } catch {
    return null
  }
}

function saveDraft(path: string, draft: StoredLocalDraft) {
  try {
    localStorage.setItem(getDraftStorageKey(path), JSON.stringify(draft))
  } catch {
    // Ignore quota/storage errors: drafts are best-effort.
  }
}

function clearDraft(path: string) {
  localStorage.removeItem(getDraftStorageKey(path))
}

export default function LocalNoteInline({ summary, onClose }: LocalNoteInlineProps) {
  const { saveDocument, deleteDocument, moveDocument } = useVaultStore()

  const [editorKey, setEditorKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [renameFileOpen, setRenameFileOpen] = useState(false)
  const [documentTitle, setDocumentTitle] = useState(summary.title)
  const [frontmatter, setFrontmatter] = useState<string | null>(null)
  const [editorDocument, setEditorDocument] = useState<TipTapDocument>(EMPTY_DOC)
  const [editorPlainText, setEditorPlainText] = useState('')
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(summary.parentPath)
  const [pendingFileName, setPendingFileName] = useState<string>(stripMarkdownExtension(summary.name))
  const [detectedDate, setDetectedDate] = useState<DetectedDate | null>(null)
  const [dateCandidates, setDateCandidates] = useState<DetectedDate[]>([])
  const [dismissedDateRaws, setDismissedDateRaws] = useState<string[]>([])
  const [dateSelectionMode, setDateSelectionMode] = useState<DateSelectionMode>(null)

  const updatedAt = useMemo(() => normalizeTimestamp(summary.updatedAt), [summary.updatedAt])

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    setSaveError(null)

    try {
      const loadedDocument = await activeDocumentRepository.readDocument(summary.path)
      const rawParts = splitRawVaultDocument(loadedDocument.rawContent)
      const storedDraft = loadDraft(summary.path)
      const dateMetadata = readDateFrontmatter(rawParts.frontmatter)
      const persistedDate = dateMetadata.dueDate && dateMetadata.dueDateRaw
        ? { iso: dateMetadata.dueDate, raw: dateMetadata.dueDateRaw }
        : null

      setFrontmatter(rawParts.frontmatter)
      setEditorDocument(storedDraft?.editorDocument ?? markdownToTipTapDocument(rawParts.body))
      setEditorPlainText(rawParts.body)
      setDocumentTitle(loadedDocument.title)
      setIsDirty(!!storedDraft)
      setPendingFolderId(storedDraft?.pendingFolderId ?? summary.parentPath)
      setPendingFileName(storedDraft?.pendingFileName ?? stripMarkdownExtension(summary.name))
      setDetectedDate(storedDraft?.detectedDate ?? persistedDate)
      setDismissedDateRaws(storedDraft?.dismissedDateRaws ?? dateMetadata.dismissedDueDateRaws)
      setDateSelectionMode((storedDraft?.detectedDate ?? persistedDate) ? 'manual' : null)
      setEditorKey((value) => value + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to read the document.')
    } finally {
      setIsLoading(false)
    }
  }, [summary.path])

  useEffect(() => {
    void loadDocument()
  }, [loadDocument])

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isDirty) {
      clearDraft(summary.path)
      return
    }

    const timer = window.setTimeout(() => {
      saveDraft(summary.path, {
        editorDocument,
        pendingFolderId,
        pendingFileName,
        detectedDate,
        dismissedDateRaws,
      })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [detectedDate, dismissedDateRaws, editorDocument, isDirty, isLoading, pendingFileName, pendingFolderId, summary.path])

  useEffect(() => {
    const nextCandidates = parseDates(editorPlainText)
      .map((result) => ({
        iso: result.date().toISOString(),
        raw: result.text,
      }))
      .filter((candidate) => !dismissedDateRaws.includes(candidate.raw))
      .filter((candidate, index, list) => (
        list.findIndex((entry) => entry.raw === candidate.raw && entry.iso === candidate.iso) === index
      ))

    setDateCandidates(nextCandidates)
    setDetectedDate((current) => {
      if (current && nextCandidates.some((candidate) => candidate.raw === current.raw && candidate.iso === current.iso)) {
        if (dateSelectionMode === 'auto' && nextCandidates.length > 1) {
          setDateSelectionMode(null)
          return null
        }

        return current
      }

      if (nextCandidates.length === 1) {
        setDateSelectionMode('auto')
        return nextCandidates[0]
      }

      setDateSelectionMode(null)
      return null
    })
  }, [dateSelectionMode, dismissedDateRaws, editorPlainText])

  const handleChange = useCallback((doc: TipTapDocument, plainText: string) => {
    setEditorDocument(doc)
    setEditorPlainText(plainText)
    setIsDirty(true)
  }, [])

  const handleClearDetectedDate = useCallback(() => {
    if (!detectedDate) {
      return
    }

    setDismissedDateRaws((previous) => (
      previous.includes(detectedDate.raw) ? previous : [...previous, detectedDate.raw]
    ))
    setDetectedDate(null)
    setDateSelectionMode(null)
    setIsDirty(true)
  }, [detectedDate])

  const handleChooseDetectedDate = useCallback((candidate: DetectedDate) => {
    setDetectedDate((current) => {
      if (current?.raw === candidate.raw && current?.iso === candidate.iso) {
        return current
      }

      return candidate
    })
    setDateSelectionMode('manual')
    setDismissedDateRaws((previous) => previous.filter((entry) => entry !== candidate.raw))
    setEditorKey((value) => value + 1)
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const markdownBody = tipTapDocumentToMarkdown(editorDocument)
      const nextFrontmatter = updateDateFrontmatter(frontmatter, {
        dueDate: detectedDate?.iso ?? null,
        dueDateRaw: detectedDate?.raw ?? null,
        dismissedDueDateRaws: dismissedDateRaws,
      })
      const rawContent = mergeRawVaultDocument({
        frontmatter: nextFrontmatter,
        body: markdownBody,
      })
      const savedDocument = await saveDocument(summary.path, rawContent)

      if (savedDocument) {
        const shouldMoveOrRename = pendingFolderId !== summary.parentPath || pendingFileName !== stripMarkdownExtension(summary.name)

        if (shouldMoveOrRename) {
          const movedDocument = await moveDocument(savedDocument.path, pendingFolderId, pendingFileName)
          if (movedDocument) {
            clearDraft(summary.path)
            setIsDirty(false)
            if (onClose) {
              onClose()
            }
          }
        } else {
          setDocumentTitle(savedDocument.title)
          setFrontmatter(nextFrontmatter)
          setIsDirty(false)
          clearDraft(summary.path)
        }
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the document.')
    } finally {
      setIsSaving(false)
    }
  }, [detectedDate, dismissedDateRaws, editorDocument, frontmatter, moveDocument, onClose, pendingFolderId, pendingFileName, saveDocument, summary.name, summary.parentPath, summary.path])

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    setSaveError(null)

    try {
      await deleteDocument(summary.path)
      clearDraft(summary.path)
      onClose?.()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to delete the document.')
    } finally {
      setIsDeleting(false)
      setIsConfirmingDelete(false)
    }
  }, [deleteDocument, onClose, summary.path])

  const handleMove = useCallback(async (newFolderId: string | null) => {
    setSaveError(null)

    if (isDirty) {
      setPendingFolderId(newFolderId)
      return
    }

    try {
      const movedDocument = await moveDocument(summary.path, newFolderId)
      if (movedDocument && onClose) {
        onClose()
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to move the document.')
    }
  }, [isDirty, moveDocument, onClose, summary.path])

  const handleRenameFile = useCallback(async (nextName: string) => {
    if (!nextName.trim() || nextName.trim() === pendingFileName) {
      setRenameFileOpen(false)
      return
    }
    setSaveError(null)

    if (isDirty) {
      setPendingFileName(nextName.trim())
      setRenameFileOpen(false)
      return
    }

    try {
      const movedDocument = await moveDocument(summary.path, summary.parentPath, nextName.trim())
      if (movedDocument && onClose) {
        onClose()
      }
      setRenameFileOpen(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to rename the file.')
    }
  }, [isDirty, moveDocument, onClose, pendingFileName, summary.parentPath, summary.path])

  if (isLoading) {
    return (
      <div className="group flex flex-col p-4 sm:p-6 rounded-[1.25rem] bg-white border border-stone-100 shadow-soft">
        <p className="text-sm text-stone-400">Loading document...</p>
      </div>
    )
  }

  return (
    <div className="group flex flex-col p-4 sm:p-6 rounded-[1.25rem] bg-white border transition-colors duration-300 border-stone-100 shadow-soft hover:border-stone-200 hover:shadow-soft-lg">
      <NoteEditor
        key={editorKey}
        content={editorDocument}
        onChange={handleChange}
        onSave={() => {
          void handleSave()
        }}
        onBeforeNavigate={async () => {
          if (isDirty) {
            await handleSave()
          }
        }}
        placeholder="Write your note..."
        autofocus={summary.excerpt.length === 0}
        preferredDateRaw={detectedDate?.raw}
        dismissedDateRaws={dismissedDateRaws}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-2 border-t border-stone-100">
        <div className="flex items-center gap-3 flex-wrap">
          <FolderSelector folderId={pendingFolderId} onChange={(newFolderId) => {
            void handleMove(newFolderId)
          }} />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
            {documentTitle}
          </span>
          <span className="text-xs text-stone-400">{formatDate(updatedAt)}</span>
          {detectedDate && (
            <button
              type="button"
              onClick={handleClearDetectedDate}
              className="group/date inline-flex items-center gap-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-100"
            >
              <span>Due {detectedDate.raw} → {formatDetectedDate(detectedDate.iso)}</span>
              <span className="hidden text-[11px] font-medium text-amber-600 group-hover/date:inline">
                Remove
              </span>
            </button>
          )}
          {!detectedDate && dateCandidates.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-stone-400">Reminder:</span>
              {dateCandidates.map((candidate) => {
                return (
                  <button
                    key={`${candidate.raw}-${candidate.iso}`}
                    type="button"
                    onClick={() => handleChooseDetectedDate(candidate)}
                    className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-800"
                  >
                    {candidate.raw}
                  </button>
                )
              })}
            </div>
          )}
          {isDirty && (pendingFolderId !== summary.parentPath || pendingFileName !== stripMarkdownExtension(summary.name)) && (
            <span className="text-xs text-amber-600">Path change will apply on save</span>
          )}
          {saveError && (
            <span className="text-xs text-red-500">{saveError}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <button
            type="button"
            onClick={() => {
              setRenameFileOpen(true)
            }}
            className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          >
            Rename file
          </button>
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[0.8125rem] text-stone-500 mr-1">Delete?</span>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDelete()
                }}
                disabled={isDeleting}
                className="text-[0.8125rem] font-semibold px-4 py-1.5 rounded-lg bg-red-100 text-red-600 hover-lift-sm hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? '...' : 'Yes'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              Delete
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            >
              Close
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void handleSave()
            }}
            disabled={isSaving || !isDirty}
            className="text-[0.8125rem] font-medium px-4 py-[0.45rem] rounded-lg bg-stone-900 text-stone-50 shadow-sm hover-lift-sm hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <TextPromptDialog
        open={renameFileOpen}
        title="Rename note file"
        description="Update the Markdown filename on disk."
        placeholder="File name"
        initialValue={pendingFileName}
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onCancel={() => setRenameFileOpen(false)}
        onConfirm={handleRenameFile}
      />
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

function formatDetectedDate(iso: string) {
  const parsed = new Date(iso)

  if (Number.isNaN(parsed.getTime())) {
    return iso
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stripMarkdownExtension(name: string) {
  return name.replace(/\.(md|markdown)$/i, '')
}
