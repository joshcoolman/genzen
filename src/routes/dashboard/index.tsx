import { createFileRoute } from '@tanstack/react-router'
import { useAccountStatus } from '@/lib/account-status'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
  const accountStatus = useAccountStatus()

  if (accountStatus !== 'active') {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Home</h1>
        <div className="bg-card rounded-lg p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold text-accent-gold">
            You're on the list
          </h2>
          <p className="text-muted-foreground">
            Thanks for signing up. We'll let you know when your account is
            activated.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="text-muted-foreground">
        Welcome back. Use the sidebar to navigate.
      </p>
    </div>
  )
}
