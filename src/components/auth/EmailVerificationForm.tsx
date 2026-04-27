import { useState, type FormEvent } from 'react'
import { useVerifyEmail, useResendVerificationCode } from '../../api/authApi'

interface Props {
  /** Email dell'utente non verificato, precompilata dal login */
  email: string
  /** Callback per tornare al form di login (es. cambio email) */
  onBackToLogin: () => void
  /** Callback invocata dopo una verifica andata a buon fine */
  onVerified: () => void
}

export default function EmailVerificationForm({ email, onBackToLogin, onVerified }: Props) {
  const [code, setCode] = useState('')

  const {
    mutate: verifyEmail,
    isPending: isVerifying,
    error: verifyError,
  } = useVerifyEmail()

  const {
    mutate: resendCode,
    isPending: isResending,
    isSuccess: resendSuccess,
    error: resendError,
    reset: resetResend,
  } = useResendVerificationCode()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // onSuccess: la sessione non esiste ancora, torna al login con flag verified
    verifyEmail({ email, code }, { onSuccess: onVerified })
  }

  function handleResend() {
    resetResend()
    resendCode({ email })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        {/* Intestazione */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            {/* Icona envelope */}
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verifica email</h1>
          <p className="text-sm text-gray-500 mt-1">
            Abbiamo inviato un codice a 6 cifre a
          </p>
          <p className="text-sm font-medium text-gray-800 mt-0.5">{email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Codice */}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Codice di verifica
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl tracking-[0.5em] font-mono text-gray-900 placeholder-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              placeholder="------"
            />
          </div>

          {/* Errore verifica */}
          {verifyError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {verifyError.message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isVerifying || code.length < 6}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
          >
            {isVerifying ? 'Verifica in corso…' : 'Verifica email'}
          </button>
        </form>

        {/* Sezione reinvio codice */}
        <div className="mt-6 text-center space-y-2">
          {resendSuccess && (
            <p className="text-sm text-green-600 font-medium">
              Codice inviato! Controlla la tua casella email.
            </p>
          )}
          {resendError && (
            <p className="text-sm text-red-600">{resendError.message}</p>
          )}

          <p className="text-sm text-gray-500">
            Non hai ricevuto il codice?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 transition"
            >
              {isResending ? 'Invio in corso…' : 'Reinvia codice'}
            </button>
          </p>

          <p className="text-sm text-gray-400">
            <button
              type="button"
              onClick={onBackToLogin}
              className="hover:text-gray-600 transition"
            >
              ← Torna al login
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
