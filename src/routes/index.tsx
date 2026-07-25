import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'

/**
 * There is no marketing homepage — genzen is a personal tool with one user, so
 * `/` is just a fork: straight to the app if you're signed in, otherwise to the
 * login screen.
 *
 * This redirects from the component rather than `beforeLoad` on purpose. Auth
 * state lives in localStorage, so it can only be read on the client, and a
 * route's `beforeLoad` does not run again after the server has already matched
 * it — a direct hit on `/` would sit there forever. `login.tsx` resolves the
 * same problem the same way.
 */
export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    navigate({ to: user ? '/dashboard' : '/login', replace: true })
  }, [user, loading, navigate])

  return null
}
