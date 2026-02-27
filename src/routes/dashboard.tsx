import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { AccountStatusProvider } from '@/lib/account-status'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useDashboardRouteMemory } from '@/lib/use-dashboard-route-memory'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('account_status')
      .eq('id', session.user.id)
      .single()

    return {
      accountStatus:
        profile?.account_status === 'active'
          ? ('active' as const)
          : ('waitlist' as const),
    }
  },
  component: DashboardLayoutRoute,
})

function DashboardLayoutRoute() {
  const { user, loading } = useAuth()
  const { accountStatus } = Route.useRouteContext()

  // Remember the last visited dashboard route
  useDashboardRouteMemory()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <AccountStatusProvider status={accountStatus}>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </AccountStatusProvider>
  )
}
