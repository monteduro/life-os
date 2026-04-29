import FolderItem from './FolderItem'
import type { Folder } from '../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface FolderTreeProps {
  folders: Folder[]
  activeDragFolderId: string | null
  pendingMoveFolderId: string | null
  overFolderId: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FolderTree({
  folders,
  activeDragFolderId,
  pendingMoveFolderId,
  overFolderId,
}: FolderTreeProps) {
  const visibleFolders = pendingMoveFolderId ? removeFolderById(folders, pendingMoveFolderId) : folders

  if (visibleFolders.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-stone-400">
        No folders yet. Create the first one.
      </div>
    )
  }

  return (
      <div className="flex flex-col gap-0.5">
      {visibleFolders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          activeDragFolderId={activeDragFolderId}
          overFolderId={overFolderId}
        />
      ))}
    </div>
  )
}

function removeFolderById(folders: Folder[], folderId: string): Folder[] {
  return folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) => ({
      ...folder,
      children: removeFolderById(folder.children ?? [], folderId),
    }))
}
