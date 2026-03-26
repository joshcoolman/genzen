import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

// JWKS is fetched once and cached by jose for the process lifetime
const getJWKS = (() => {
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
  return () => {
    if (!jwks) {
      const url = process.env.VITE_SUPABASE_URL
      if (url) {
        jwks = createRemoteJWKSet(
          new URL(`${url}/auth/v1/.well-known/jwks.json`),
        )
      }
    }
    return jwks
  }
})()

export async function requireAuth(accessToken: string) {
  if (!accessToken) {
    throw new Error('Unauthorized')
  }

  const jwks = getJWKS()
  if (jwks) {
    try {
      const { payload } = await jwtVerify(accessToken, jwks)
      if (payload.sub) {
        return { id: payload.sub, email: payload.email as string | undefined }
      }
    } catch {
      // fall through to remote verification
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
