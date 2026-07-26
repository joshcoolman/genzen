import { getSupabaseAdmin } from './supabase-admin.server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase'
import { requireUserId } from '@/features/auth/server/current-user.server'

export interface ResolvedAuth {
  userId: string
  supabase: SupabaseClient<Database>
}

/**
 * Identity for the current request, plus a database client.
 *
 * Previously this took an `accessToken` off the request *body* and verified it
 * against Supabase's remote JWKS. The caller no longer says who it is -- the
 * signed session cookie does -- which is what retired `jose`, the JWKS fetch,
 * and the `accessToken` field that rode along in 232 places.
 *
 * IMPORTANT: the returned client is service-role and bypasses RLS. Every read
 * and write MUST carry an explicit `.eq('user_id', userId)` filter. That was
 * already true on the old MCP path; it is now the only path. RLS is not a
 * second line of defence here -- 0001_init.sql drops the policies outright, on
 * the grounds that after this migration the browser cannot reach Postgres at
 * all, so there is no untrusted caller left for a policy to guard against.
 */
export async function resolveAuth(): Promise<ResolvedAuth> {
  const userId = await requireUserId()
  return { userId, supabase: getSupabaseAdmin() }
}
