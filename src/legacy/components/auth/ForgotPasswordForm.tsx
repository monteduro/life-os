import { useState, type FormEvent } from 'react'
import { useForgotPassword } from '../../api/authApi'

interface Props {
  onBackToLogin: () => void
}

export default function ForgotPasswordForm({ onBackToLogin }: Props) {
  const [email, setEmail] = useState('')
  const { mutate: forgotPassword, isPending, isSuccess, error } = useForgotPassword()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    forgotPassword({ email })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Smart Notes</h1>
          <p className="text-sm text-gray-500 mt-1">Reset password</p>
        </div>

        {isSuccess ? (
          /* Success state — request sent */
          <div className="space-y-5">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-700 text-center">
              <p className="font-medium mb-1">Email sent!</p>
              <p>
                If <span className="font-medium">{email}</span> is registered, you will receive a
                link to reset your password.
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-gray-500">
              Enter your email address and we will send you a link to reset your password.
            </p>

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
              {isPending ? 'Sending...' : 'Send reset link'}
            </button>

            {/* Back to sign in */}
            <p className="text-center text-sm text-gray-600">
              <button
                type="button"
                onClick={onBackToLogin}
                className="font-medium text-gray-600 hover:text-gray-500 transition"
              >
                ← Back to sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
