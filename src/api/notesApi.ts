import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { API_ENDPOINTS } from '../config/api'

export type {
  TipTapNode,
  TipTapDocument,
  Note,
  NoteAttachment,
  NoteMention,
  CreateNoteDto,
  UpdateNoteDto,
  ApiResponse,
} from '../types'

import type { Note, CreateNoteDto, UpdateNoteDto, ApiResponse } from '../types'

// --- Query keys centralizzate ---

export const noteKeys = {
  all: ['notes'] as const,
  detail: (id: string) => ['notes', id] as const,
  byFolder: (folderId: string | null) =>
    ['notes', { folderId }] as const,
}

// --- Hooks ---

/**
 * GET /notes — filtrato per folder.
 * folderId === null  → inbox (folder_id=null)
 * folderId === string → note della cartella specifica
 * folderId === undefined → tutte le note (nessun filtro)
 */
export const useNotes = (folderId?: string | null) => {
  const hasFilter = folderId !== undefined

  return useQuery<Note[]>({
    queryKey: hasFilter ? noteKeys.byFolder(folderId!) : noteKeys.all,
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (hasFilter) {
        params.folder_id = folderId === null ? 'null' : folderId!
      }
      const res = await apiClient.get<ApiResponse<Note[]>>(API_ENDPOINTS.notes, { params })
      return res.data
    },
  })
}

// GET /notes/:id
export const useNote = (id: string) => {
  return useQuery<Note>({
    queryKey: noteKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Note>>(`${API_ENDPOINTS.notes}/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

// POST /notes
export const useCreateNote = () => {
  const queryClient = useQueryClient()

  return useMutation<Note, Error, CreateNoteDto>({
    mutationFn: async (data) => {
      const res = await apiClient.post<ApiResponse<Note>>(API_ENDPOINTS.notes, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
    },
  })
}

// PUT /notes/:id
export const useUpdateNote = (id: string) => {
  const queryClient = useQueryClient()

  return useMutation<Note, Error, UpdateNoteDto>({
    mutationFn: async (data) => {
      const res = await apiClient.put<ApiResponse<Note>>(`${API_ENDPOINTS.notes}/${id}`, data)
      return res.data
    },
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(noteKeys.detail(id), updatedNote)
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
    },
  })
}

// DELETE /notes/:id
export const useDeleteNote = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete<void>(`${API_ENDPOINTS.notes}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
    },
  })
}
