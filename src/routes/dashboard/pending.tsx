import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/dashboard/pending')({
  beforeLoad: ({ context }) => {
    // Active users shouldn't be here
    if ((context as { accountStatus: string }).accountStatus === 'active') {
      throw redirect({ to: '/dashboard/ai-images' })
    }
  },
  component: PendingPage,
})

function PendingPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-foreground">
          You're on the list
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          GenZen is currently invite-only. You'll get access as soon as your
          account is activated.
        </p>
        {user?.email && (
          <p className="text-xs text-muted-foreground">
            Signed in as {user.email}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
