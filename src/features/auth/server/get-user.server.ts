import { requireUserId } from './current-user.server'
import type { AuthUser } from '#/lib/auth'
import { first, sql } from '#/lib/server/db.server'

/**
 * The signed-in user's row, for the layout to hand to the client provider.
 *
 * Returns null when the session cookie is valid but the row is gone -- a user
 * deleted out from under a live cookie. The layout treats that as signed out
 * rather than crashing, which is the only way that state resolves.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const userId = await requireUserId()
  const row = first(
    await sql<
      Array<{
        id: string
        email: string
        display_name: string | null
        created_at: Date
      }>
    >`
    select id, email, display_name, created_at from users where id = ${userId}
  `,
  )
  if (row === undefined) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString(),
  }
}
