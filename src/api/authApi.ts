import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { ApiError } from './client'
import { API_ENDPOINTS } from '../config/api'

// --- Tipi ---

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

// Errore speciale lanciato da useLogin quando il backend risponde con
// 403 + email_unverified: true. Trasporta l'email per pre-popolare
// il form di verifica.
export class EmailUnverifiedError extends Error {
  readonly email: string

  constructor(email: string) {
    super('Devi verificare la tua email prima di accedere.')
    this.name = 'EmailUnverifiedError'
    this.email = email
  }
}

// --- Query keys ---

export const authKeys = {
  user: ['user'] as const,
}

// --- Helper ---

// Recupera il CSRF cookie da Sanctum. Va chiamato prima di ogni
// richiesta autenticata (login, register). Il cookie XSRF-TOKEN
// viene poi letto automaticamente da ApiClient per le mutazioni.
// L'endpoint è al di fuori di /api, quindi costruiamo l'URL dall'origin.
export async function fetchCsrfCookie(): Promise<void> {
  // Usiamo window.location.origin (es. http://localhost:5173) invece di
  // derivare l'URL dal backend. In questo modo la richiesta passa dal
  // proxy Vite → il cookie XSRF-TOKEN viene settato per localhost
  // ed è leggibile da document.cookie nello stesso origin.
  await fetch(`${window.location.origin}${API_ENDPOINTS.csrfCookie}`, {
    credentials: 'include',
  })
}

// --- Hooks ---

// GET /user — restituisce l'utente autenticato oppure null se non loggato.
// retry: false evita ritentativi inutili su 401.
export const useCurrentUser = () => {
  return useQuery<User | null>({
    queryKey: authKeys.user,
    queryFn: async () => {
      try {
        // GET /user risponde con { user: { ... } }
        const res = await apiClient.get<{ user: User }>(API_ENDPOINTS.user)
        return res.user
      } catch {
        // 401 Unauthorized → utente non autenticato
        return null
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minuti — l'utente non cambia spesso
  })
}

// POST /login — autentica l'utente.
// Prima fetcha il CSRF cookie (necessario per Sanctum), poi invia le credenziali.
// Se il backend risponde 403 con email_unverified: true, lancia EmailUnverifiedError
// così il componente può mostrare il form di verifica email.
export const useLogin = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, LoginCredentials>({
    mutationFn: async (credentials) => {
      await fetchCsrfCookie()
      try {
        await apiClient.post(API_ENDPOINTS.login, credentials)
      } catch (err) {
        // Intercetta il 403 con email_unverified per offrire il flusso di verifica
        if (err instanceof ApiError && err.body.email_unverified === true) {
          throw new EmailUnverifiedError(err.body.email as string)
        }
        throw err
      }
    },
    onSuccess: () => {
      // Invalida la query utente → useCurrentUser rifetcha GET /user
      // con la sessione appena creata → App.tsx vede user valorizzato
      queryClient.invalidateQueries({ queryKey: authKeys.user })
      // Invalida le note così vengono ricaricate con la sessione attiva
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// POST /register — registra un nuovo utente.
// Non setta l'utente in cache: il backend richiede la verifica email
// prima di creare la sessione, quindi dopo la registrazione il componente
// mostra il form di verifica (EmailVerificationForm).
export const useRegister = () => {
  return useMutation<void, Error, RegisterCredentials>({
    mutationFn: async (credentials) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.register, credentials)
    },
  })
}

// POST /logout — disconnette l'utente e pulisce la cache.
export const useLogout = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient.post(API_ENDPOINTS.logout)
    },
    onSuccess: () => {
      // Pulisce tutta la cache: utente, note, ecc.
      queryClient.clear()
    },
  })
}

// POST /email/verify — verifica l'email con il codice a 6 cifre ricevuto via email.
// In caso di successo, invalida la query utente per rifetcharla (ora sarà verificata).
export const useVerifyEmail = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, VerifyEmailCredentials>({
    mutationFn: async (credentials) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.email.verify, credentials)
    },
    onSuccess: () => {
      // Dopo la verifica, GET /user restituirà email_verified_at valorizzato
      queryClient.invalidateQueries({ queryKey: authKeys.user })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// POST /email/resend — reinvia il codice di verifica all'email indicata.
export const useResendVerificationCode = () => {
  return useMutation<void, Error, ResendVerificationPayload>({
    mutationFn: async (payload) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.email.resend, payload)
    },
  })
}

// --- Password Reset ---

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  email: string
  token: string
  password: string
  password_confirmation: string
}

// POST /forgot-password — invia il link di ripristino password all'email indicata.
export const useForgotPassword = () => {
  return useMutation<void, Error, ForgotPasswordPayload>({
    mutationFn: async (payload) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.password.forgot, payload)
    },
  })
}

// POST /reset-password — reimposta la password usando il token ricevuto via email.
export const useResetPassword = () => {
  return useMutation<void, Error, ResetPasswordPayload>({
    mutationFn: async (payload) => {
      await fetchCsrfCookie()
      await apiClient.post(API_ENDPOINTS.password.reset, payload)
    },
  })
}
