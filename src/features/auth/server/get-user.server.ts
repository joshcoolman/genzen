import { requireUserId } from './current-user.server'
import type { AuthUser } from '@/lib/auth'
import { sql } from '@/lib/server/db.server'

/**
 * The signed-in user's row, for the layout to hand to the client provider.
 *
 * Returns null when the session cookie is valid but the row is gone -- a user
 * deleted out from under a live cookie. The layout treats that as signed out
 * rather than crashing, which is the only way that state resolves.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const userId = await requireUserId()
  const [row] = await sql<
    Array<{
      id: string
      email: string
      displayName: string | null
      createdAt: Date
    }>
  >`
    select id, email, display_name, created_at from users where id = ${userId}
  `
  if ((row as typeof row | undefined) === undefined) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
  }
}
