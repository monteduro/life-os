import FolderItem from './FolderItem'
import type { Folder } from '../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface FolderTreeProps {
  folders: Folder[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FolderTree({ folders }: FolderTreeProps) {
  if (folders.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-stone-400">
        Nessuna cartella. Crea la prima!
      </div>
    )
  }

  return (
      <div className="flex flex-col gap-0.5">
      {folders.map((folder) => (
        <FolderItem key={folder.id} folder={folder} />
      ))}
    </div>
  )
}
