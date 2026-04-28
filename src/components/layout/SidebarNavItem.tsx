import type { LucideIcon } from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarNavItemProps {
  Icon: LucideIcon
  label: string
  count?: number
  isActive: boolean
  onClick: () => void
  className?: string
  style?: React.CSSProperties
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SidebarNavItem({
  Icon,
  label,
  count,
  isActive,
  onClick,
  className,
  style,
}: SidebarNavItemProps) {
  return (
    <button
      onClick={onClick}
      style={style}
      className={`
        flex items-center gap-2 rounded-lg transition-colors w-full relative z-10
        py-1.5 pr-8 pl-[4px] text-[13px]
        ${isActive
          ? 'bg-stone-100/90 text-stone-900 font-semibold'
          : 'text-stone-700 hover:bg-stone-100/60'
        }
        ${className ?? ''}
      `}
    >
      <Icon className={`w-4 h-4 shrink-0 relative z-20 ${isActive ? 'text-stone-900' : 'text-stone-600 group-hover:text-stone-900'}`} />

      {/* Label */}
      <span className="flex-1 min-w-0 text-left truncate relative z-20">{label}</span>

      {/* Count badge */}
      {count !== undefined && count > 0 && (
        <div className="p-1 shrink-0 absolute right-1 z-20 flex items-center justify-center w-[26px] h-6">
          <span className="text-[11px] font-medium text-stone-400 shrink-0">
            {count}
          </span>
        </div>
      )}
    </button>
  )
}
