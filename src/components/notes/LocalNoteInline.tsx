import { useCallback, useEffect, useMemo, useState } from 'react'

import NoteEditor from '../editor/NoteEditor'
import TextPromptDialog from '../Form/TextPromptDialog'
import { activeDocumentRepository } from '../../core/storage/activeStorage'
import { formatDate } from '../../lib/utils'
import { useVaultStore } from '../../stores/vaultStore'
import FolderSelector from './FolderSelector'
import {
  markdownToTipTapDocument,
  mergeRawVaultDocument,
  splitRawVaultDocument,
  tipTapDocumentToMarkdown,
} from '../../core/vault/markdownDocument'
import type { TipTapDocument } from '../../types'
import type { VaultDocumentSummary } from '../../core/vault/types'

interface LocalNoteInlineProps {
  summary: VaultDocumentSummary
  onClose?: () => void
}

const EMPTY_DOC: TipTapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
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
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(summary.parentPath)
  const [pendingFileName, setPendingFileName] = useState<string>(stripMarkdownExtension(summary.name))

  const updatedAt = useMemo(() => normalizeTimestamp(summary.updatedAt), [summary.updatedAt])

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    setSaveError(null)

    try {
      const loadedDocument = await activeDocumentRepository.readDocument(summary.path)
      const rawParts = splitRawVaultDocument(loadedDocument.rawContent)

      setFrontmatter(rawParts.frontmatter)
      setEditorDocument(markdownToTipTapDocument(rawParts.body))
      setDocumentTitle(loadedDocument.title)
      setIsDirty(false)
      setPendingFolderId(summary.parentPath)
      setPendingFileName(stripMarkdownExtension(summary.name))
      setEditorKey((value) => value + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Impossibile leggere il documento.')
    } finally {
      setIsLoading(false)
    }
  }, [summary.path])

  useEffect(() => {
    void loadDocument()
  }, [loadDocument])

  const handleChange = useCallback((doc: TipTapDocument) => {
    setEditorDocument(doc)
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const markdownBody = tipTapDocumentToMarkdown(editorDocument)
      const rawContent = mergeRawVaultDocument({
        frontmatter,
        body: markdownBody,
      })
      const savedDocument = await saveDocument(summary.path, rawContent)

      if (savedDocument) {
        const shouldMoveOrRename = pendingFolderId !== summary.parentPath || pendingFileName !== stripMarkdownExtension(summary.name)

        if (shouldMoveOrRename) {
          const movedDocument = await moveDocument(savedDocument.path, pendingFolderId, pendingFileName)
          if (movedDocument && onClose) {
            onClose()
          }
        } else {
          setDocumentTitle(savedDocument.title)
          setIsDirty(false)
        }
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Impossibile salvare il documento.')
    } finally {
      setIsSaving(false)
    }
  }, [editorDocument, frontmatter, moveDocument, onClose, pendingFolderId, saveDocument, summary.parentPath, summary.path])

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    setSaveError(null)

    try {
      await deleteDocument(summary.path)
      onClose?.()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Impossibile eliminare il documento.')
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
      setSaveError(error instanceof Error ? error.message : 'Impossibile spostare il documento.')
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
      setSaveError(error instanceof Error ? error.message : 'Impossibile rinominare il file.')
    }
  }, [isDirty, moveDocument, onClose, pendingFileName, summary.parentPath, summary.path])

  if (isLoading) {
    return (
      <div className="group flex flex-col p-4 sm:p-6 rounded-[1.25rem] bg-white border border-stone-100 shadow-soft">
        <p className="text-sm text-stone-400">Caricamento documento…</p>
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
        placeholder="Scrivi la tua nota…"
        autofocus={summary.excerpt.length === 0}
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
                onClick={() => {
                  void handleDelete()
                }}
                disabled={isDeleting}
                className="text-[0.8125rem] font-semibold px-4 py-1.5 rounded-lg bg-red-100 text-red-600 hover-lift-sm hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? '...' : 'Sì'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              Elimina
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            >
              Chiudi
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
            {isSaving ? 'Salvataggio…' : 'Salva'}
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

function stripMarkdownExtension(name: string) {
  return name.replace(/\.(md|markdown)$/i, '')
}
