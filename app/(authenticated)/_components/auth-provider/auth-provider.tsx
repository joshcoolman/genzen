'use client'

import type { ReactNode } from 'react'
import type { AuthUser } from '#/lib/auth'
import { AuthContext } from '#/lib/auth'

/**
 * Carries the server-resolved user into client components.
 *
 * It holds no state and subscribes to nothing. The Supabase version had to:
 * it read a session out of localStorage, re-verified it against the server,
 * and listened for `onAuthStateChange`, which is why every page below it
 * opened with a `loading` branch. A cookie the server already read needs none
 * of that.
 */
export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser
  children: ReactNode
}) {
  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  )
}
