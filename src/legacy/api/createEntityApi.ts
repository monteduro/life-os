import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { apiClient } from './client'
import type { ApiResponse } from '../../types'

// ─── Configuration ────────────────────────────────────────────────────────────

interface EntityApiConfig {
  /** Base endpoint, e.g. '/folders' */
  endpoint: string
  /** Query key prefix, e.g. 'folders' */
  queryKey: string
  /** Other query keys to invalidate on mutation (e.g. ['notes'] when a folder changes) */
  relatedKeys?: string[]
}

// ─── Return Type ──────────────────────────────────────────────────────────────

interface EntityApi<TEntity, TCreateDto, TUpdateDto> {
  /** Centralized query keys */
  keys: {
    all: readonly [string]
    detail: (id: string) => readonly [string, string]
  }
  /** GET /endpoint → TEntity[] */
  useList: (params?: Record<string, string>) => UseQueryResult<TEntity[], Error>
  /** GET /endpoint/:id → TEntity */
  useDetail: (id: string) => UseQueryResult<TEntity, Error>
  /** POST /endpoint */
  useCreate: () => UseMutationResult<TEntity, Error, TCreateDto, unknown>
  /** PUT /endpoint/:id */
  useUpdate: (id: string) => UseMutationResult<TEntity, Error, TUpdateDto, unknown>
  /** DELETE /endpoint/:id */
  useDelete: () => UseMutationResult<void, Error, string, unknown>
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createEntityApi<TEntity, TCreateDto, TUpdateDto>(
  config: EntityApiConfig
): EntityApi<TEntity, TCreateDto, TUpdateDto> {

  // Centralized query keys
  const keys = {
    all: [config.queryKey] as const,
    detail: (id: string) => [config.queryKey, id] as const,
  }

  // GET /endpoint → TEntity[]
  const useList = (params?: Record<string, string>) => {
    return useQuery<TEntity[], Error>({
      queryKey: params ? [...keys.all, params] as const : keys.all,
      queryFn: async () => {
        const res = await apiClient.get<ApiResponse<TEntity[]>>(config.endpoint, { params })
        return res.data
      },
    })
  }

  // GET /endpoint/:id → TEntity
  const useDetail = (id: string) => {
    return useQuery<TEntity, Error>({
      queryKey: keys.detail(id),
      queryFn: async () => {
        const res = await apiClient.get<ApiResponse<TEntity>>(`${config.endpoint}/${id}`)
        return res.data
      },
      enabled: !!id,
    })
  }

  // POST /endpoint
  const useCreate = () => {
    const queryClient = useQueryClient()
    return useMutation<TEntity, Error, TCreateDto>({
      mutationFn: async (data) => {
        const res = await apiClient.post<ApiResponse<TEntity>>(config.endpoint, data)
        return res.data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: keys.all })
        config.relatedKeys?.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      },
    })
  }

  // PUT /endpoint/:id
  const useUpdate = (id: string) => {
    const queryClient = useQueryClient()
    return useMutation<TEntity, Error, TUpdateDto>({
      mutationFn: async (data) => {
        const res = await apiClient.put<ApiResponse<TEntity>>(`${config.endpoint}/${id}`, data)
        return res.data
      },
      onSuccess: (updatedEntity) => {
        queryClient.setQueryData(keys.detail(id), updatedEntity)
        queryClient.invalidateQueries({ queryKey: keys.all })
        config.relatedKeys?.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      },
    })
  }

  // DELETE /endpoint/:id
  const useDelete = () => {
    const queryClient = useQueryClient()
    return useMutation<void, Error, string>({
      mutationFn: (id) => apiClient.delete<void>(`${config.endpoint}/${id}`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: keys.all })
        config.relatedKeys?.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      },
    })
  }

  return {
    keys,
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
  }
}
