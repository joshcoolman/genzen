'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from './session'

// Lives in the feature rather than a route's `_actions/` folder because its
// caller is the sidebar, which belongs to no single route.
export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE_NAME)
  redirect('/login')
}
