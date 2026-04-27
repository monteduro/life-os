// Configurazione API — valore da .env, con fallback al backend locale
// Il path /api è incluso nella base (come da smartnote-api.json → servers[0].url)
export const API_BASE_URL: string = import.meta.env.VITE_API_URL

// Endpoints
// Il server base è già http://smart-notes.test/api (vedi smartnote-api.json → servers[0].url)
// quindi i path non ripetono /api
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
