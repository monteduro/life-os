import { useState, type FormEvent } from 'react'
import { useRegister } from '../../api/authApi'
import EmailVerificationForm from './EmailVerificationForm'

interface Props {
  onSwitchToLogin: () => void
}

export default function RegisterForm({ onSwitchToLogin }: Props) {
  const { mutate: register, isPending, error } = useRegister()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')

  // Newly registered email: set after success to show verification
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    register(
      { name, email, password, password_confirmation: passwordConfirmation },
      {
        onSuccess: () => {
          // Show the email verification form using the newly registered email
          setRegisteredEmail(email)
        },
      },
    )
  }

  // After registration → email verification
  if (registeredEmail) {
    return (
      <EmailVerificationForm
        email={registeredEmail}
        onBackToLogin={onSwitchToLogin}
        onVerified={onSwitchToLogin}
      />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        {/* Logo / Titolo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Smart Notes</h1>
          <p className="text-sm text-gray-500 mt-1">Create a new account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              placeholder="Mario Rossi"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="reg-email"
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
            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              placeholder="••••••••"
            />
          </div>

          {/* Conferma Password */}
          <div>
            <label
              htmlFor="reg-password-confirm"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm password
            </label>
            <input
              id="reg-password-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              placeholder="••••••••"
            />
          </div>

          {/* Error */}
          {error && (
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
            {isPending ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        {/* Link al login */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-blue-600 hover:text-blue-700 transition"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
