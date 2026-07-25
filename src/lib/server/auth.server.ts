import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabase-admin.server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase'

const supabaseUrl = process.env.VITE_SUPABASE_URL

// JWKS is fetched once and cached by jose for the process lifetime
const getJWKS = (() => {
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
  return () => {
    if (!jwks && supabaseUrl) {
      jwks = createRemoteJWKSet(
        new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
      )
    }
    return jwks
  }
})()

// Supabase JWT issuer is <project-url>/auth/v1
const expectedIssuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined

export async function requireAuth(accessToken: string) {
  if (!accessToken) {
    throw new Error('Unauthorized')
  }

  const jwks = getJWKS()
  if (jwks) {
    try {
      const { payload } = await jwtVerify(accessToken, jwks, {
        audience: 'authenticated',
        issuer: expectedIssuer,
        clockTolerance: 60,
      })
      if (payload.sub) {
        return { id: payload.sub, email: payload.email as string | undefined }
      }
    } catch (err) {
      console.warn(
        '[auth] Local JWT verification failed, falling back to remote:',
        (err as Error).message,
      )
    }
  }

  // Fallback: remote verification
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken)

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
}

export interface AuthInput {
  accessToken?: string
  userId?: string
}

export interface ResolvedAuth {
  userId: string
  supabase: SupabaseClient<Database>
}

/**
 * Resolves either a Supabase access token (browser path, RLS-scoped client)
 * or a pre-verified userId (MCP path, service-role client). Server fns that
 * support both auth channels should call this once and use the returned
 * client for all queries.
 *
 * IMPORTANT: when called with `userId`, the returned client bypasses RLS.
 * Every read and write MUST include an explicit `.eq('user_id', userId)`
 * filter (or equivalent path scoping) to prevent cross-user access.
 */
export async function resolveAuth(input: AuthInput): Promise<ResolvedAuth> {
  if (input.userId) {
    return { userId: input.userId, supabase: getSupabaseAdmin() }
  }
  if (!input.accessToken) {
    throw new Error('Unauthorized')
  }
  const user = await requireAuth(input.accessToken)
  const supabase = createClient<Database>(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      },
    },
  )
  return { userId: user.id, supabase }
}
