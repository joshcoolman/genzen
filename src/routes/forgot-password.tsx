import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/login` },
    )

    setSubmitting(false)

    if (resetError) {
      setError(resetError.message)
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-2xl font-semibold text-accent-gold">
            Check your email
          </h1>
          <p className="text-muted-foreground">
            If that email exists, you'll receive a reset link.
          </p>
          <Link
            to="/login"
            className="inline-block text-sm text-accent-gold hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-accent-gold">
            Reset your password
          </h1>
          <p className="text-muted-foreground mt-1">
            Enter your email to receive a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/30 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-accent-gold text-primary-foreground rounded-md hover:bg-accent-gold-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {submitting ? '...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-accent-gold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
