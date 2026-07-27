import { requireUserId } from '@/features/auth/server/current-user.server'

export interface ResolvedAuth {
  userId: string
}

/**
 * Identity for the current request.
 *
 * Previously this took an `accessToken` off the request *body* and verified it
 * against Supabase's remote JWKS. The caller no longer says who it is -- the
 * signed session cookie does -- which is what retired `jose`, the JWKS fetch,
 * and the `accessToken` field that rode along in 232 places.
 *
 * IMPORTANT: `sql` from `db.server` connects as the owning role and there is no
 * RLS behind it. Every read and write MUST carry an explicit
 * `where user_id = ${userId}` filter -- 0001_init.sql drops the policies
 * outright, on the grounds that after this migration the browser cannot reach
 * Postgres at all, so there is no untrusted caller left for a policy to guard
 * against. The `userId` this returns is the only thing standing between one
 * user's rows and another's.
 */
export async function resolveAuth(): Promise<ResolvedAuth> {
  const userId = await requireUserId()
  return { userId }
}
