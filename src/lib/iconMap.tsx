import {
  Inbox,
  Folder,
  FolderOpen,
  FileText,
  Clipboard,
  ClipboardList,
  BookOpen,
  Book,
  Archive,
  CheckCircle2,
  Circle,
  Clock,
  Home,
  Briefcase,
  GraduationCap,
  Heart,
  Music,
  ShoppingCart,
  DollarSign,
  Users,
  type LucideIcon,
} from 'lucide-react'

// ─── Icon Map ─────────────────────────────────────────────────────────────────

/**
 * Maps icon name strings to Lucide icon components.
 * Used to render icons from backend data.
 */
export const iconMap: Record<string, LucideIcon> = {
  // Default entity icons
  inbox: Inbox,
  folder: Folder,
  'folder-open': FolderOpen,
  file: FileText,
  clipboard: Clipboard,
  'clipboard-list': ClipboardList,
  book: Book,
  'book-open': BookOpen,
  archive: Archive,

  // Status icons
  'check-circle': CheckCircle2,
  circle: Circle,
  clock: Clock,

  // Common category icons
  home: Home,
  briefcase: Briefcase,
  graduation: GraduationCap,
  heart: Heart,
  music: Music,
  cart: ShoppingCart,
  dollar: DollarSign,
  users: Users,
}

// ─── Default Icons ────────────────────────────────────────────────────────────

export const defaultIcons = {
  inbox: Inbox,
  folder: Folder,
} as const

// ─── Get Icon Component ───────────────────────────────────────────────────────

/**
 * Returns the Lucide icon component for a given icon name.
 * Falls back to default icon if not found.
 */
export function getIcon(
  iconName: string | null | undefined,
  fallbackType: 'inbox' | 'folder' = 'folder'
): LucideIcon {
  if (!iconName?.trim()) {
    return defaultIcons[fallbackType]
  }

  const normalizedName = iconName.toLowerCase().trim()
  return iconMap[normalizedName] ?? defaultIcons[fallbackType]
}
