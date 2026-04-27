import { API_BASE_URL } from '../config/api'

// Estende le opzioni native di fetch aggiungendo "params"
// per supportare query string (?key=value) in modo dichiarativo
interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

// Errore HTTP tipizzato: espone lo status code e il body completo
// così i consumer (es. authApi.ts) possono ispezionare campi custom
// come "email_unverified" restituiti dal backend.
export class ApiError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

class ApiClient {
  // Legge il cookie XSRF-TOKEN impostato da Laravel Sanctum.
  // Il valore è URL-encoded, quindi va decodificato prima di usarlo come header.
  private getCsrfToken(): string | null {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  // Metodo privato centrale: tutte le richieste HTTP passano da qui.
  // È generico (<T>) così TypeScript sa che tipo di dato aspettarsi in risposta.
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    // Separiamo "params" dalle opzioni di fetch native (params non esiste in fetch)
    const { params, ...fetchOptions } = options

    // Costruisce l'URL completo usando API_BASE_URL da config/api.ts
    // es. "http://smart-notes.test/api/notes"
    let url = `${API_BASE_URL}${endpoint}`

    // Se ci sono query params, li aggiunge all'URL
    // es. { page: '2', limit: '10' } → "?page=2&limit=10"
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    // Costruisce la config per fetch, fondendo:
    // - credentials: 'include' per inviare i cookie di sessione Sanctum
    // - gli header di default (Content-Type, Accept)
    // - gli eventuali header custom passati nelle options (es. Authorization)
    // - il resto delle fetchOptions (method, body, signal, ecc.)
    const config: RequestInit = {
      credentials: 'include', // Necessario per Laravel Sanctum (session cookie)
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...fetchOptions.headers, // override degli header di default se necessario
      },
      ...fetchOptions,
    }

    // Per le richieste che modificano dati (POST, PUT, PATCH, DELETE),
    // Laravel Sanctum richiede il token XSRF come header X-XSRF-TOKEN.
    // Il token viene letto dal cookie XSRF-TOKEN impostato da /sanctum/csrf-cookie.
    const method = (config.method ?? 'GET').toUpperCase()
    if (!['GET', 'HEAD'].includes(method)) {
      const csrfToken = this.getCsrfToken()
      if (csrfToken) {
        ;(config.headers as Record<string, string>)['X-XSRF-TOKEN'] = csrfToken
      }
    }

    const response = await fetch(url, config)

    // fetch non lancia errori per 4xx/5xx: dobbiamo controllare response.ok manualmente.
    // response.ok è true solo per status 200-299.
    if (!response.ok) {
      // Tenta di leggere il body dell'errore (es. { message: "Not found" } da Laravel)
      // Se il body non è JSON valido, usa statusText come fallback
      const body = await response.json().catch(() => ({
        message: response.statusText,
      }))
      throw new ApiError(
        body.message || `Request failed: ${response.status}`,
        response.status,
        body,
      )
    }

    // Le risposte 204 No Content (tipiche dei DELETE) non hanno body:
    // chiamare .json() su di esse lancerebbe un errore
    if (response.status === 204) {
      return undefined as unknown as T
    }

    // Parsa e ritorna il body JSON tipizzato come T
    return response.json()
  }

  // GET — recupera dati (lettura)
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  // POST — crea una risorsa (scrittura)
  post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data), // serializza il payload in JSON
    })
  }

  // PUT — sostituisce una risorsa intera (aggiornamento completo)
  put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // PATCH — aggiorna solo alcuni campi (aggiornamento parziale)
  patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // DELETE — elimina una risorsa
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

// Esportiamo una singola istanza condivisa (singleton pattern)
export const apiClient = new ApiClient()
