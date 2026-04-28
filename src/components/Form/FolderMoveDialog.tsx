import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Search } from 'lucide-react'

import { mapVaultFoldersToAppFolders } from '../../core/vault/adapters'
import { useVaultStore } from '../../stores/vaultStore'
import { getIcon } from '../../lib/iconMap'
import type { Folder } from '../../types'

interface FolderMoveDialogProps {
  open: boolean
  currentFolderId: string
  currentFolderName: string
  targetParentId: string | null
  onCancel: () => void
  onConfirm: (targetParentId: string | null) => void | Promise<void>
}

export default function FolderMoveDialog({
  open,
  currentFolderId,
  currentFolderName,
  targetParentId,
  onCancel,
  onConfirm,
}: FolderMoveDialogProps) {
  const currentVault = useVaultStore((state) => state.currentVault)
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(targetParentId)

  useEffect(() => {
    if (!open) {
      return
    }

    setSearch('')
    setExpandedFolders(new Set())
    setSelectedTargetId(targetParentId)
  }, [open, targetParentId])

  const folders = useMemo(() => {
    if (!currentVault) return []
    return mapVaultFoldersToAppFolders(currentVault.folders)
  }, [currentVault])

  const excludedIds = useMemo(() => {
    const currentFolder = flattenFolders(folders).find((folder) => folder.id === currentFolderId)
    if (!currentFolder) {
      return new Set<string>([currentFolderId])
    }

    return new Set<string>(collectFolderIds(currentFolder))
  }, [currentFolderId, folders])

  const folderTree = useMemo(() => {
    const activeFolders = folders.filter((folder) => !folder.is_archived)
    const rootFolders = activeFolders.filter((folder) => folder.parent_id === null)
    const visibleTree = rootFolders
      .map((folder) => filterFolder(folder, excludedIds, search))
      .filter((folder): folder is Folder => folder !== null)

    return visibleTree
  }, [excludedIds, folders, search])

  if (!open || !currentVault) {
    return null
  }

  const InboxIcon = getIcon(null, 'inbox')

  const toggleFolder = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderFolderItem = (folder: Folder, depth = 0): React.ReactNode => {
    const hasChildren = !!folder.children?.length
    const isExpanded = expandedFolders.has(folder.id) || !!search.trim()
    const isSelected = selectedTargetId === folder.id
    const Icon = getIcon(folder.icon, 'folder')

    return (
      <div key={folder.id} className="flex flex-col">
        <button
          type="button"
          onClick={() => setSelectedTargetId(folder.id)}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left transition-colors ${
            isSelected ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-600 hover:bg-stone-50'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div className="w-3.5 flex items-center justify-center">
            {hasChildren ? (
              <div
                onClick={(event) => toggleFolder(folder.id, event)}
                className="p-0.5 rounded transition-colors hover:bg-stone-200/50"
              >
                <ChevronRight className={`h-3 w-3 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
            ) : (
              <Icon className="h-3 w-3 text-stone-300" />
            )}
          </div>
          <span className="flex-1 truncate">{folder.name}</span>
          {isSelected && <Check className="h-3.5 w-3.5 text-stone-700" />}
        </button>

        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {folder.children!.map((child) => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/20 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-stone-900">Move folder</h2>
          <p className="text-sm text-stone-500">
            Choose the new parent for <span className="font-medium text-stone-700">{currentFolderName}</span>.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-stone-400" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search folders..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-stone-800 outline-none"
          />
        </div>

        <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-stone-100 p-1">
          <button
            type="button"
            onClick={() => setSelectedTargetId(null)}
            className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
              selectedTargetId === null ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <div className="w-3.5 flex items-center justify-center">
              <InboxIcon className="h-3 w-3 text-stone-300" />
            </div>
            <span className="flex-1 truncate">{currentVault.rootName}</span>
            {selectedTargetId === null && <Check className="h-3.5 w-3.5 text-stone-700" />}
          </button>

          {folderTree.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-stone-400">No available destinations</div>
          ) : (
            folderTree.map((folder) => renderFolderItem(folder))
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm(selectedTargetId)
            }}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  )
}

function flattenFolders(folders: Folder[]): Folder[] {
  return folders.flatMap((folder) => [folder, ...flattenFolders(folder.children ?? [])])
}

function collectFolderIds(folder: Folder): string[] {
  return [folder.id, ...(folder.children ?? []).flatMap(collectFolderIds)]
}

function filterFolder(folder: Folder, excludedIds: Set<string>, search: string): Folder | null {
  if (excludedIds.has(folder.id)) {
    return null
  }

  const filteredChildren = (folder.children ?? [])
    .map((child) => filterFolder(child, excludedIds, search))
    .filter((child): child is Folder => child !== null)

  if (!search.trim()) {
    return {
      ...folder,
      children: filteredChildren,
    }
  }

  const lowerQuery = search.toLowerCase()
  const matchesSelf = folder.name.toLowerCase().includes(lowerQuery)

  if (!matchesSelf && filteredChildren.length === 0) {
    return null
  }

  return {
    ...folder,
    children: filteredChildren,
  }
}
