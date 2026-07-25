import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useDashboardRouteMemory } from '@/lib/use-dashboard-route-memory'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    // Skip auth check on server -- Supabase client uses localStorage
    // which isn't available during SSR. The component handles the
    // loading/redirect dance client-side via AuthProvider.
    if (typeof window === 'undefined') return

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardLayoutRoute,
})

function DashboardLayoutRoute() {
  const { user, loading } = useAuth()

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
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
