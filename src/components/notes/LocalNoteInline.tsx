import { useCallback, useEffect, useMemo, useState } from 'react'

import NoteEditor from '../editor/NoteEditor'
import { activeDocumentRepository } from '../../core/storage/activeStorage'
import { formatDate } from '../../lib/utils'
import { useVaultStore } from '../../stores/vaultStore'
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
  const { saveDocument, deleteDocument } = useVaultStore()

  const [editorKey, setEditorKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [documentTitle, setDocumentTitle] = useState(summary.title)
  const [frontmatter, setFrontmatter] = useState<string | null>(null)
  const [editorDocument, setEditorDocument] = useState<TipTapDocument>(EMPTY_DOC)

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
        setDocumentTitle(savedDocument.title)
        setIsDirty(false)
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Impossibile salvare il documento.')
    } finally {
      setIsSaving(false)
    }
  }, [editorDocument, frontmatter, saveDocument, summary.path])

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
    }
  }, [deleteDocument, onClose, summary.path])

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
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
            {documentTitle}
          </span>
          <span className="text-xs text-stone-400">{formatDate(updatedAt)}</span>
          {saveError && (
            <span className="text-xs text-red-500">{saveError}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <button
            type="button"
            onClick={() => {
              void handleDelete()
            }}
            disabled={isDeleting}
            className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors"
          >
            {isDeleting ? 'Eliminazione…' : 'Elimina'}
          </button>
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
