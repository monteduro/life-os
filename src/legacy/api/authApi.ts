import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { ApiError } from './client'
import { API_ENDPOINTS } from '../config/api'

// --- Types ---

export interface User {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  lang: string | null
  created_at: string
  updated_at: string
}

export interface LoginCredentials {
  email: string
  password: string
  remember: boolean
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface VerifyEmailCredentials {
  email: string
  code: string
}

export interface ResendVerificationPayload {
  email: string
}

// Special error thrown by useLogin when the backend responds with
// 403 + email_unverified: true. Carries the email so the verification
// form can be prefilled.
export class EmailUnverifiedError extends Error {
  readonly email: string

  constructor(email: string) {
    super('You must verify your email before signing in.')
    this.name = 'EmailUnverifiedError'
    this.email = email
  }
}

// --- Query keys ---

export const authKeys = {
  user: ['user'] as const,
}

// --- Helpers ---

// Fetches the CSRF cookie from Sanctum. Must be called before any
// authenticated request (login, register). ApiClient then reads the
// XSRF-TOKEN cookie automatically for mutations.
// The endpoint is outside /api, so we build the URL from the origin.
export async function fetchCsrfCookie(): Promise<void> {
  // Use window.location.origin (for example http://localhost:5173) instead of
  // deriving the URL from the backend. This keeps the request on the Vite proxy,
  // so the XSRF-TOKEN cookie is set for localhost
  // and is readable from document.cookie on the same origin.
  await fetch(`${window.location.origin}${API_ENDPOINTS.csrfCookie}`, {
    credentials: 'include',
  })
}

// --- Hooks ---

// GET /user — returns the authenticated user or null when signed out.
// retry: false avoids pointless retries on 401.
export const useCurrentUser = () => {
  return useQuery<User | null>({
    queryKey: authKeys.user,
    queryFn: async () => {
      try {
        // GET /user responds with { user: { ... } }
        const res = await apiClient.get<{ user: User }>(API_ENDPOINTS.user)
        return res.user
      } catch {
        // 401 Unauthorized → unauthenticated user
        return null
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes — the user state rarely changes
  })
}

// POST /login — authenticates the user.
// It fetches the CSRF cookie first (required by Sanctum), then sends credentials.
// If the backend responds with 403 and email_unverified: true, it throws
// EmailUnverifiedError so the component can show the email verification form.
export const useLogin = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, LoginCredentials>({
    mutationFn: async (credentials) => {
      await fetchCsrfCookie()
      try {
        await apiClient.post(API_ENDPOINTS.login, credentials)
      } catch (err) {
        // Intercept the 403 + email_unverified case to offer the verification flow
        if (err instanceof ApiError && err.body.email_unverified === true) {
          throw new EmailUnverifiedError(err.body.email as string)
        }
        throw err
      }
    },
    onSuccess: () => {
      // Invalidate the user query so useCurrentUser refetches GET /user
      // with the newly created session and App.tsx sees the populated user.
      queryClient.invalidateQueries({ queryKey: authKeys.user })
      // Invalidate notes so they reload with the active session
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// POST /register — registers a new user.
// It does not set the user in cache: the backend requires email verification
// before creating the session, so after registration the component
// shows the verification form (EmailVerificationForm).
export const useRegister = () => {
  return useMutation<void, Error, RegisterCredentials>({
    mutationFn: async (credentials) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.register, credentials)
    },
  })
}

// POST /logout — signs the user out and clears the cache.
export const useLogout = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient.post(API_ENDPOINTS.logout)
    },
    onSuccess: () => {
      // Clear the entire cache: user, notes, and so on.
      queryClient.clear()
    },
  })
}

// POST /email/verify — verifies the email using the 6-digit code received by email.
// On success, invalidates the user query so it refetches with the verified state.
export const useVerifyEmail = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, VerifyEmailCredentials>({
    mutationFn: async (credentials) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.email.verify, credentials)
    },
    onSuccess: () => {
      // After verification, GET /user will return a populated email_verified_at
      queryClient.invalidateQueries({ queryKey: authKeys.user })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// POST /email/resend — resends the verification code to the provided email.
export const useResendVerificationCode = () => {
  return useMutation<void, Error, ResendVerificationPayload>({
    mutationFn: async (payload) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.email.resend, payload)
    },
  })
}

// --- Password reset ---

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  email: string
  token: string
  password: string
  password_confirmation: string
}

// POST /forgot-password — sends the password reset link to the provided email.
export const useForgotPassword = () => {
  return useMutation<void, Error, ForgotPasswordPayload>({
    mutationFn: async (payload) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.password.forgot, payload)
    },
  })
}

// POST /reset-password — resets the password using the token received by email.
export const useResetPassword = () => {
  return useMutation<void, Error, ResetPasswordPayload>({
    mutationFn: async (payload) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.password.reset, payload)
    },
  })
}
