import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'
import { verifyApiKey } from './api-keys.server'

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

export async function requireAuthFromApiKey(rawKey: string) {
  if (!rawKey) {
    throw new Error('Unauthorized')
  }
  try {
    const { userId } = await verifyApiKey({ rawKey })
    return { id: userId, email: undefined as string | undefined }
  } catch {
    throw new Error('Unauthorized')
  }
}
