import { redirect } from 'next/navigation'
import { DashboardShell } from './_components/dashboard-shell/dashboard-shell'
import { getCurrentUser } from '#/features/auth/server/get-user.server'
import { AuthProvider } from '#/components/auth-provider'

// Identity is resolved once here, on the server, and handed down. `proxy.ts`
// has already turned away anyone without a valid cookie; the redirect below
// only catches a cookie whose user row no longer exists.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  // Valid cookie, no such user -- the row was deleted or its id changed under a
  // live session. Redirecting to /login would loop, because proxy.ts only checks
  // the signature and would send it right back; the cookie has to be cleared,
  // and only a route handler can do that.
  if (!user) redirect('/api/auth/sign-out')

  return (
    <AuthProvider user={user}>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
