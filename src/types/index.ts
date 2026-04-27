// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
}

// ─── TipTap Document ──────────────────────────────────────────────────────────

export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

export interface TipTapDocument {
  type: 'doc'
  content: TipTapNode[]
}

// ─── Note ─────────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  content: TipTapDocument
  content_plain: string
  folder_id: string | null      // null = inbox
  due_date: string | null
  due_date_raw: string | null
  is_task: boolean
  is_archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  attachments?: NoteAttachment[]
  mentions?: NoteMention[]
}

export interface NoteAttachment {
  id: string
  note_id: string
  filename: string
  original_name: string
  mime_type: string
  size_bytes: number
  url: string
}

export interface NoteMention {
  id: string
  note_id: string
  mentionable_type: 'folder'
  mentionable_id: string
}

export interface CreateNoteDto {
  content: TipTapDocument
  content_plain: string
  folder_id?: string | null     // null = inbox
  due_date?: string | null
  due_date_raw?: string | null
  is_task?: boolean
}

export interface UpdateNoteDto {
  content?: TipTapDocument
  content_plain?: string
  folder_id?: string | null
  due_date?: string | null
  due_date_raw?: string | null
  is_task?: boolean
  is_archived?: boolean
  sort_order?: number
}

// ─── Folder ──────────────────────────────────────────────────────────────────

export interface Folder {
  id: string
  parent_id: string | null       // null = root level folder
  name: string
  description: string | null
  icon: string | null
  due_date: string | null        // when set, folder acts as a "project"
  sort_order: number
  is_archived: boolean
  notes_count: number
  children?: Folder[]            // nested folders (populated recursively)
  created_at: string
  updated_at: string
}

// ─── Folder DTOs ──────────────────────────────────────────────────────────────

export interface CreateFolderDto {
  name: string
  description?: string
  icon?: string
  parent_id?: string | null
  due_date?: string | null
}

export interface UpdateFolderDto {
  name?: string
  description?: string
  icon?: string
  parent_id?: string | null
  due_date?: string | null
  sort_order?: number
}

// ─── Folder Reorder ──────────────────────────────────────────────────────────

export interface ReorderFolderItem {
  id: string
  sort_order: number
  parent_id?: string | null   // omit = keep current parent, null = move to root
}
