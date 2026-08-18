import { redirect } from 'next/navigation'
import { AppShell } from './_components/app-shell/app-shell'
import { AuthProvider } from './_components/auth-provider/auth-provider'
import { getCurrentUser } from '#/features/auth/server/get-user.server'
import { deriveTheme, themeToCss } from '#/features/theme'
import { getUserTheme } from '#/features/theme/theme-store.server'

// `(authenticated)` is a route group: it draws a layout boundary and contributes
// nothing to the URL, so this file's children serve /images, /canvas and the
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

  // The whole of the theming feature's application (#406). One `<style>`, no
  // provider, no client state, no `data-theme` attribute -- components never
  // learn a theme exists, they just read the same `var(--token)` they always
  // did. It overrides `tokens.css` on document order alone, being a `:root`
  // block that renders after the stylesheet in `<head>`.
  //
  // Server-rendered, so the palette is in the first byte of HTML and there is
  // no flash. And **nothing is emitted without a saved row** -- an
  // uncustomized app renders `tokens.css` untouched, which is what stops
  // `DEFAULT_CORE` and the stylesheet from being two copies of one palette that
  // have to be kept in agreement.
  const core = await getUserTheme(user.id)

  return (
    <AuthProvider user={user}>
      {core && <style>{themeToCss(deriveTheme(core))}</style>}
      <AppShell>{children}</AppShell>
    </AuthProvider>
  )
}
