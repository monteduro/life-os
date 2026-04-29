// API configuration — value from .env, with a fallback to the local backend.
// The /api path is already included in the base URL (see smartnote-api.json → servers[0].url).
export const API_BASE_URL: string = import.meta.env.VITE_API_URL

// Endpoints
// The base server is already http://smart-notes.test/api (see smartnote-api.json → servers[0].url),
// so the endpoint paths do not repeat /api.
export const API_ENDPOINTS = {
  notes: '/notes',
  folders: '/folders',
  register: '/register',
  login: '/login',
  logout: '/logout',
  user: '/user',
  csrfCookie: '/sanctum/csrf-cookie',
  email: {
    verify: '/email/verify',
    resend: '/email/resend',
  },
  password: {
    forgot: '/password/forgot',
    reset: '/password/reset',
  },
} as const
