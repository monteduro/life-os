import { API_BASE_URL } from '../config/api'

// Extends the native fetch options with "params"
// to support query strings (?key=value) declaratively.
interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

// Typed HTTP error: exposes the status code and the full response body
// so consumers (for example authApi.ts) can inspect custom fields
// such as "email_unverified" returned by the backend.
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
  // Reads the XSRF-TOKEN cookie set by Laravel Sanctum.
  // The value is URL-encoded, so it must be decoded before using it as a header.
  private getCsrfToken(): string | null {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  // Central private method: every HTTP request goes through here.
  // It is generic (<T>) so TypeScript knows the response shape.
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    // Split "params" from the native fetch options ("params" is not a fetch option).
    const { params, ...fetchOptions } = options

    // Builds the full URL using API_BASE_URL from config/api.ts,
    // for example "http://smart-notes.test/api/notes".
    let url = `${API_BASE_URL}${endpoint}`

    // Adds query params to the URL when present,
    // for example { page: '2', limit: '10' } → "?page=2&limit=10".
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    // Builds the fetch config by merging:
    // - credentials: 'include' to send Sanctum session cookies
    // - default headers (Content-Type, Accept)
    // - any custom headers passed in options (for example Authorization)
    // - the remaining fetchOptions (method, body, signal, and so on)
    const config: RequestInit = {
      credentials: 'include', // Required for Laravel Sanctum session cookies
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...fetchOptions.headers, // override default headers when needed
      },
      ...fetchOptions,
    }

    // For requests that modify data (POST, PUT, PATCH, DELETE),
    // Laravel Sanctum requires the XSRF token in the X-XSRF-TOKEN header.
    // The token is read from the XSRF-TOKEN cookie set by /sanctum/csrf-cookie.
    const method = (config.method ?? 'GET').toUpperCase()
    if (!['GET', 'HEAD'].includes(method)) {
      const csrfToken = this.getCsrfToken()
      if (csrfToken) {
        ;(config.headers as Record<string, string>)['X-XSRF-TOKEN'] = csrfToken
      }
    }

    const response = await fetch(url, config)

    // fetch does not throw for 4xx/5xx responses, so we must check response.ok ourselves.
    // response.ok is true only for 200-299 status codes.
    if (!response.ok) {
      // Try to read the error body (for example { message: "Not found" } from Laravel).
      // If the body is not valid JSON, fall back to statusText.
      const body = await response.json().catch(() => ({
        message: response.statusText,
      }))
      throw new ApiError(
        body.message || `Request failed: ${response.status}`,
        response.status,
        body,
      )
    }

    // 204 No Content responses (common for DELETE) do not have a body:
    // calling .json() on them would throw.
    if (response.status === 204) {
      return undefined as unknown as T
    }

    // Parse and return the JSON body typed as T.
    return response.json()
  }

  // GET — fetch data (read)
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  // POST — create a resource (write)
  post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data), // serialize the payload as JSON
    })
  }

  // PUT — replace an entire resource (full update)
  put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // PATCH — update only some fields (partial update)
  patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // DELETE — delete a resource
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

// Export a single shared instance (singleton pattern).
export const apiClient = new ApiClient()
