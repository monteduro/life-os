import { ChevronRight } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useNavigationStore } from '../../stores/navigationStore'
import { getIcon } from '../../lib/iconMap'
import type { Folder } from '../../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface FolderItemProps {
  folder: Folder
  depth?: number
  activeDragFolderId: string | null
  overFolderId: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FolderItem({
  folder,
  depth = 0,
  activeDragFolderId,
  overFolderId,
}: FolderItemProps) {
  const { selectedFolderId, expandedFolders, selectFolder, toggleFolder } = useNavigationStore()
  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: folder.id,
  })
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: folder.id,
  })

  const isSelected = selectedFolderId === folder.id
  const isExpanded = expandedFolders.has(folder.id)
  const hasChildren = folder.children && folder.children.length > 0
  const isDropTarget = isOver && activeDragFolderId !== folder.id && overFolderId === folder.id

  // Icon
  const Icon = getIcon(folder.icon, 'folder')

  // Make root folders slightly more prominent.
  const isRoot = depth === 0

  const paddingLeft = 4 + depth * 22

  // Recompute childBranchLeft: paddingLeft + half the icon width.
  const branchLeft = paddingLeft + 8; // pl + w-4(16px)/2

  const setNodeRef = (node: HTMLDivElement | null) => {
    setDroppableRef(node)
    setDraggableRef(node)
  }

  return (
    <div ref={setNodeRef} className="relative">
        {/* Folder button */}
        <button
          onClick={() => selectFolder(folder.id, folder.name)}
          {...attributes}
          {...listeners}
        style={{ paddingLeft: `${paddingLeft}px` }}
        className={`
          flex items-center gap-2 rounded-lg transition-colors w-full relative z-10
          ${isRoot ? 'py-1.5 pr-8 text-[13px]' : 'py-1 pr-8 text-[13px]'}
          ${isSelected
            ? 'bg-stone-100/90 text-stone-900 font-medium'
            : 'text-stone-700 hover:bg-stone-100/60'
          }
          ${isDropTarget ? 'ring-1 ring-stone-300 bg-stone-100/90' : ''}
          ${isDragging ? 'cursor-grabbing opacity-50' : 'cursor-default active:cursor-grabbing'}
        `}
        >
        {/* Icon */}
        <Icon className={`w-4 h-4 shrink-0 relative z-20 ${isSelected ? 'text-stone-800' : 'text-stone-400 group-hover:text-stone-500'}`} />

        {/* Name */}
        <span className="flex-1 min-w-0 text-left truncate relative z-20">{folder.name}</span>

        {/* Count badge - solo per leaf nodes */}
        {folder.notes_count > 0 && !hasChildren && (
          <div className="p-1 shrink-0 absolute right-1 z-20 flex items-center justify-center w-[26px] h-6">
            <span className="text-[11px] font-medium text-stone-400 shrink-0">
              {folder.notes_count}
            </span>
          </div>
        )}

        {/* Chevron per expand/collapse sulla destra */}
        {hasChildren && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              toggleFolder(folder.id)
            }}
            className="p-1 hover:bg-stone-200/50 rounded transition-colors shrink-0 absolute right-1 z-20 flex items-center justify-center w-[26px] h-6"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        )}
        </button>

      {/* Children (ricorsivo) con linea albero stilizzata */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col relative w-full">
          {folder.children!.map((child, index) => {
            const isLast = index === folder.children!.length - 1;
            return (
              <div key={child.id} className="relative w-full">
                {/* L-shaped curve to the item. */}
                <div
                  className="absolute top-0 border-l border-b border-stone-200 rounded-bl-md pointer-events-none z-0"
                  style={{
                    left: `${branchLeft}px`,
                    width: '12px',
                    height: '14px'
                  }}
                />
                {/* Continuing vertical line for non-last items */}
                {!isLast && (
                  <div
                    className="absolute top-[14px] bottom-0 w-px bg-stone-200 pointer-events-none z-0"
                    style={{ left: `${branchLeft}px` }}
                  />
                )}
                <FolderItem
                  folder={child}
                  depth={depth + 1}
                  activeDragFolderId={activeDragFolderId}
                  overFolderId={overFolderId}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}
