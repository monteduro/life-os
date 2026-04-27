import { useState, type FormEvent } from 'react'
import { useLogin, EmailUnverifiedError } from '../../api/authApi'
import EmailVerificationForm from './EmailVerificationForm'

interface Props {
  onSwitchToRegister: () => void
  onForgotPassword: () => void
  passwordResetSuccess?: boolean
}

export default function LoginForm({ onSwitchToRegister, onForgotPassword, passwordResetSuccess }: Props) {
  const [email, setEmail] = useState('me@stefanomonteduro.it')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)

  // Email da verificare: valorizzata quando il backend risponde 403 email_unverified
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  // Banner di successo mostrato dopo la verifica email andata a buon fine
  const [justVerified, setJustVerified] = useState(false)

  const { mutate: login, isPending, error } = useLogin()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    login(
      { email, password, remember },
      {
        onError: (err) => {
          // Se l'email non è verificata, mostra il form di verifica
          if (err instanceof EmailUnverifiedError) {
            setUnverifiedEmail(err.email)
          }
        },
      },
    )
  }

  // Mostra il form di verifica email se il login ha restituito email_unverified
  if (unverifiedEmail) {
    return (
      <EmailVerificationForm
        email={unverifiedEmail}
        onBackToLogin={() => setUnverifiedEmail(null)}
        onVerified={() => {
          setUnverifiedEmail(null)
          setJustVerified(true)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        {/* Logo / Titolo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Smart Notes</h1>
          <p className="text-sm text-gray-500 mt-1">Accedi al tuo account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Banner password reimpostata con successo */}
          {passwordResetSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              ✓ Password reimpostata! Ora puoi accedere con la nuova password.
            </div>
          )}

          {/* Banner email verificata */}
          {justVerified && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              ✓ Email verificata! Ora puoi accedere.
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              placeholder="me@stefanomonteduro.it"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              placeholder="••••••••"
            />
          </div>

          {/* Remember me + Forgot password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                Ricordami
              </label>
            </div>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-500 transition"
            >
              Password dimenticata?
            </button>
          </div>

          {/* Errore (escluso EmailUnverifiedError, già gestito sopra) */}
          {error && !(error instanceof EmailUnverifiedError) && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error.message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
          >
            {isPending ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>

        {/* Link alla registrazione */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Non hai un account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-medium text-blue-600 hover:text-blue-700 transition"
          >
            Registrati
          </button>
        </p>
      </div>
    </div>
  )
}
