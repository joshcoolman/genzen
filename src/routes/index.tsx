import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            GenZen
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Generate, edit, and remix images with the best AI models — all in
            one place.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : user ? (
            <button
              onClick={() => navigate({ to: '/dashboard' })}
              className="w-full max-w-xs rounded-md bg-accent-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-brand/90 transition-colors"
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate({ to: '/signup' })}
                className="w-full max-w-xs rounded-md bg-accent-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-brand/90 transition-colors"
              >
                Get Started
              </button>
              <button
                onClick={() => navigate({ to: '/login' })}
                className="w-full max-w-xs rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
