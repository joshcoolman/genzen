'use client'

import { createContext, useContext } from 'react'

// The app's own user shape. Previously this typed on Supabase's `User` and
// `Session`, which dragged the vendor's model of identity through every
// component that only ever wanted an id and an email.
export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  createdAt: string
  /** Null until the first sign-in after migration 0008 (#406). */
  lastLoginAt: string | null
}

export interface AuthContextType {
  user: AuthUser
}

export const AuthContext = createContext<AuthContextType | null>(null)

/**
 * There is no `loading` state and no nullable user. The layout is a Server
 * Component that already resolved identity from the cookie, and `proxy.ts`
 * turned away anyone without one -- so by the time a client component runs,
 * a user exists. That is what removed the loading/redirect dance every page
 * used to open with.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
