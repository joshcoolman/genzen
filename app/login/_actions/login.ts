'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  SESSION_COOKIE_NAME,
  createSessionValue,
  sessionCookieOptions,
} from '@/features/auth/session'
import { verifyCredentials } from '@/features/auth/server/credentials.server'

export interface LoginState {
  error: string | null
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const userId = await verifyCredentials(email, password)

  // One message for both "no such email" and "wrong password". `verifyCredentials`
  // already spends the same time on each; a distinct message here would hand back
  // the account-enumeration oracle that DUMMY_HASH exists to close.
  if (!userId) {
    return { error: 'Invalid email or password.' }
  }

  const store = await cookies()
  store.set(
    SESSION_COOKIE_NAME,
    await createSessionValue(userId),
    sessionCookieOptions(),
  )

  redirect('/dashboard')
}
