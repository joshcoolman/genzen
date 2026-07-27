import { redirect } from 'next/navigation'
import { AppShell } from './_components/app-shell/app-shell'
import { AuthProvider } from './_components/auth-provider/auth-provider'
import { getCurrentUser } from '#/features/auth/server/get-user.server'

// `(authenticated)` is a route group: it draws a layout boundary and contributes
// nothing to the URL, so this file's children serve /ai-images, /canvas and the
// rest. It is not the gate. `proxy.ts` is deny-by-default over every path, so a
// route created outside this group is still protected -- just without the chrome.
//
// Identity is resolved once here, on the server, and handed down. `proxy.ts`
// has already turned away anyone without a valid cookie; the redirect below
// only catches a cookie whose user row no longer exists.
export default async function AuthenticatedLayout({
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
      <AppShell>{children}</AppShell>
    </AuthProvider>
  )
}
