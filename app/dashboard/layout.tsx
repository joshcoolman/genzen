import { redirect } from 'next/navigation'
import { DashboardShell } from './_components/dashboard-shell'
import { getCurrentUser } from '@/features/auth/server/get-user.server'
import { AuthProvider } from '@/components/auth-provider'

// Identity is resolved once here, on the server, and handed down. `proxy.ts`
// has already turned away anyone without a valid cookie; the redirect below
// only catches a cookie whose user row no longer exists.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <AuthProvider user={user}>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
