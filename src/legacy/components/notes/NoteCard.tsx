import type { Note } from '../../api/notesApi'
import { useUpdateNote } from '../../api/notesApi'
import { formatDate } from '../../../lib/utils'
import FolderSelector from '../../../components/notes/FolderSelector'
interface NoteCardProps {
  note: Note
  onClick: () => void
}

export default function NoteCard({ note, onClick }: NoteCardProps) {
  const formattedDate = note.updated_at ? formatDate(note.updated_at) : null

  const { mutate: updateNote } = useUpdateNote(note.id)

  return (
    <button
      onClick={onClick}
      className="hover-lift w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-white border border-stone-100 shadow-soft hover:border-stone-200 hover:shadow-soft-lg cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <FolderSelector
          folderId={note.folder_id}
          onChange={(newFolderId) => updateNote({ folder_id: newFolderId })}
        />
        <span className="ml-auto text-xs text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">
          click to edit →
        </span>
      </div>

      {/* Content preview */}
      <p className="text-sm text-stone-500 leading-relaxed line-clamp-3">
        {note.content_plain || <span className="italic text-stone-300">Empty note</span>}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-50">
        {note.due_date_raw && (
          <span className="text-xs text-stone-400">📅 {note.due_date_raw}</span>
        )}
        {formattedDate && (
          <span className="text-xs text-stone-300 ml-auto">{formattedDate}</span>
        )}
      </div>
    </button>
  )
}
