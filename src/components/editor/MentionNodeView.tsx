import { useMemo } from 'react'
import { createElement } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { ArrowRight } from 'lucide-react'
import { getIcon } from '../../lib/iconMap'
import { fromVaultRelativePath } from '../../core/vault/paths'
import type { VaultFolderNode } from '../../core/vault/types'
import { useNavigationStore } from '../../stores/navigationStore'
import { useVaultStore } from '../../stores/vaultStore'
import { useEditorCallbacks } from './EditorCallbacksContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type MentionType = 'folder'

const TYPE_META: Record<MentionType, { label: string; badge: string; icon: string }> = {
  folder: { label: 'Cartella', badge: 'bg-blue-100 text-blue-700', icon: 'folder' },
}

// ─── Icon Component ────────────────────────────────────────────────────────────

function MentionIcon() {
  const IconComponent = useMemo(() => getIcon('folder'), [])
  return createElement(IconComponent, { className: 'w-4 h-4' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MentionNodeView({ node }: NodeViewProps) {
  const { id, label, type } = node.attrs as { id: string; label: string; type: MentionType }
  const selectFolder = useNavigationStore(s => s.selectFolder)
  const currentVault = useVaultStore(s => s.currentVault)
  const { onBeforeNavigate } = useEditorCallbacks()

  const meta = TYPE_META[type] ?? TYPE_META.folder
  const folderPath = currentVault ? fromVaultRelativePath(currentVault.rootPath, id) : null
  const isResolved = currentVault
    ? currentVault.folders.some((folder) => containsFolderPath(folder, folderPath))
    : false

  async function handleNavigate() {
    if (!folderPath || !isResolved) {
      return
    }

    // Salva automaticamente se ci sono modifiche non salvate
    if (onBeforeNavigate) {
      await onBeforeNavigate()
    }
    selectFolder(folderPath, label)
  }

  // Colori per folder mentions
  const mentionClass = isResolved ? 'text-blue-700' : 'text-amber-700 bg-amber-50'

  return (
    <NodeViewWrapper as="span" className="inline">
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>
          {/* onMouseDown preventDefault keeps editor focus intact */}
          <span
            className={`inline-flex items-center rounded px-1 py-0.5 font-medium cursor-pointer select-none text-[0.9em] ${mentionClass}`}
            data-mention-type={type}
            onMouseDown={(e) => e.preventDefault()}
          >
            @{label}
          </span>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            sideOffset={6}
            align="start"
            className="z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 outline-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {/* Header */}
            <div className="flex items-start gap-2.5 mb-3">
              <span className="shrink-0 mt-0.5 text-gray-500">
                <MentionIcon />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
                  {label}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                  {id}
                </p>
                <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.badge}`}>
                  {isResolved ? meta.label : `${meta.label} non trovata`}
                </span>
              </div>
            </div>

            {/* Navigate button */}
            <button
              onClick={handleNavigate}
              disabled={!isResolved}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 disabled:hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{isResolved ? `Vai al ${meta.label.toLowerCase()}` : 'Target non disponibile'}</span>
              <ArrowRight size={14} className="text-gray-400 shrink-0" />
            </button>

            <PopoverPrimitive.Arrow className="fill-white drop-shadow-sm" />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </NodeViewWrapper>
  )
}

function containsFolderPath(node: VaultFolderNode, targetPath: string | null): boolean {
  if (!targetPath) {
    return false
  }

  if (node.path === targetPath) {
    return true
  }

  return node.children.some((child) => containsFolderPath(child, targetPath))
}
