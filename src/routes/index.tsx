import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ActionButton } from '@/components/ActionButton'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center gap-3">
      <ActionButton
        onClick={() => navigate({ to: user ? '/dashboard' : '/login' })}
        disabled={loading}
      >
        {loading ? 'Loading...' : user ? 'Go to Dashboard' : 'Go to Login'}
      </ActionButton>
      <ActionButton onClick={() => navigate({ to: '/docs' })}>
        Documentation
      </ActionButton>
    </div>
  )
}
