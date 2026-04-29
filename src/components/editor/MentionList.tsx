import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { getIcon } from '../../lib/iconMap'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MentionItem {
  id: string
  label: string
  type: 'folder'
  icon?: string
}

interface MentionListProps {
  items: MentionItem[]
  command: (item: { id: string; label: string; type: string }) => void
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const typeLabel: Record<MentionItem['type'], string> = {
  folder: 'Folder',
}

const typeBadgeClass: Record<MentionItem['type'], string> = {
  folder: 'bg-blue-100 text-blue-600',
}

// ─── Component ────────────────────────────────────────────────────────────────

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => setSelectedIndex(0), [items])

    const selectItem = (index: number) => {
      const item = items[index]
      if (item) {
        command({ id: item.id, label: item.label, type: item.type })
      }
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (!items.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-3 px-4 min-w-[200px]">
          <p className="text-sm text-gray-400 text-center">No results</p>
        </div>
      )
    }

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[220px] max-h-[280px] overflow-y-auto">
        {items.map((item, index) => {
          const Icon = getIcon(item.icon, item.type)
          const isSelected = index === selectedIndex
          return (
            <button
              key={item.id}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`shrink-0 ${isSelected ? 'text-gray-600' : 'text-gray-400'}`}>
                <Icon size={14} />
              </span>
              <span className="flex-1 font-medium text-gray-800 truncate">{item.label}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${typeBadgeClass[item.type]}`}>
                {typeLabel[item.type]}
              </span>
            </button>
          )
        })}
      </div>
    )
  }
)

MentionList.displayName = 'MentionList'

export default MentionList
