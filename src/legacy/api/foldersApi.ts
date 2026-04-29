import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEntityApi } from './createEntityApi'
import { apiClient } from './client'
import type { Folder, CreateFolderDto, UpdateFolderDto, ReorderFolderItem } from '../../types'

// ─── Base CRUD Operations ────────────────────────────────────────────────────

const foldersApi = createEntityApi<Folder, CreateFolderDto, UpdateFolderDto>({
  endpoint: '/folders',
  queryKey: 'folders',
  relatedKeys: ['notes'],
})

export const folderKeys = foldersApi.keys
export const useFolders = foldersApi.useList
export const useFolder = foldersApi.useDetail
export const useCreateFolder = foldersApi.useCreate
export const useUpdateFolder = foldersApi.useUpdate
export const useDeleteFolder = foldersApi.useDelete

// ─── Reorder Folders ─────────────────────────────────────────────────────────

/**
 * Batch update sort_order and optionally parent_id for multiple folders.
 * PATCH /folders/reorder
 */
export function useReorderFolders() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, ReorderFolderItem[]>({
    mutationFn: (items) =>
      apiClient.patch('/folders/reorder', { folders: items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// ─── Helper: Build Folder Tree ───────────────────────────────────────────────

/** Recursively sorts folders by sort_order at each level */
function sortRecursive(folders: Folder[]) {
  folders.sort((a, b) => a.sort_order - b.sort_order)
  for (const folder of folders) {
    if (folder.children && folder.children.length > 0) {
      sortRecursive(folder.children)
    }
  }
}

/**
 * Transforms a flat list of folders into a nested tree structure.
 * If the backend already provides nested children, uses them directly.
 * Otherwise, builds the tree client-side based on parent_id.
 */
export function buildFolderTree(folders: Folder[]): Folder[] {
  if (folders.length === 0) return []

  // Check if backend already provides nested structure
  const hasNestedChildren = folders.some(f => f.children && f.children.length > 0)

  if (hasNestedChildren) {
    const rootFolders = folders.filter(f => f.parent_id === null)
    sortRecursive(rootFolders)
    return rootFolders
  }

  // Backend provides flat list — build tree client-side
  const folderMap = new Map<string, Folder>()
  const rootFolders: Folder[] = []

  for (const folder of folders) {
    folderMap.set(folder.id, { ...folder, children: [] })
  }

  for (const folder of folderMap.values()) {
    if (folder.parent_id === null) {
      rootFolders.push(folder)
    } else {
      const parent = folderMap.get(folder.parent_id)
      if (parent) {
        parent.children!.push(folder)
      } else {
        rootFolders.push(folder)
      }
    }
  }

  sortRecursive(rootFolders)
  return rootFolders
}
