// Signed session cookie: `userId.issuedAtMs.hmac`.
//
// Web Crypto only, no `node:*` imports, so this module stays usable from an
// Edge-runtime middleware once #168 reaches the Next port. Anything that needs
// `node:crypto` (password hashing) lives in `./server/credentials.server` and
// must never be imported from here.
//
// Ported from ~/repos/bootsy/src/features/auth/session.ts.
//
// Why a signed value rather than a JWT: this replaces a Supabase JWT that rode
// in the *request body* of every server function and was verified against a
// remote JWKS. There is no third party to interoperate with, so the token needs
// to carry exactly two things -- who, and when -- and an HMAC over them is the
// whole requirement.

export const SESSION_COOKIE_NAME = 'genzen_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET
  if (!secret) throw new Error('AUTH_SESSION_SECRET is not set')
  return secret
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  )
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Constant-time compare of two equal-length hex strings. Web Crypto has no
// timing-safe raw compare outside `subtle.verify`.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export interface Session {
  userId: string
  issuedAtMs: number
}

export async function createSessionValue(userId: string): Promise<string> {
  const issuedAtMs = Date.now()
  const signature = await hmacHex(`${userId}.${issuedAtMs}`, getSessionSecret())
  return `${userId}.${issuedAtMs}.${signature}`
}

export async function verifySessionValue(
  value: string | undefined,
): Promise<Session | null> {
  if (!value) return null
  const [userId, issuedAtRaw, signature] = value.split('.')
  if (!userId || !issuedAtRaw || !signature) return null

  const issuedAtMs = Number(issuedAtRaw)
  if (!Number.isFinite(issuedAtMs)) return null

  let expectedSignature: string
  try {
    expectedSignature = await hmacHex(
      `${userId}.${issuedAtRaw}`,
      getSessionSecret(),
    )
  } catch {
    return null
  }
  if (!timingSafeEqualHex(signature, expectedSignature)) return null

  if (Date.now() - issuedAtMs >= SESSION_MAX_AGE_SECONDS * 1000) return null
  return { userId, issuedAtMs }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

// Reads the session out of a raw `Cookie` header. Framework-agnostic on
// purpose: it works from a Nitro h3 route today and from a Next middleware or
// route handler after the port, so nothing here has to be rewritten twice.
export async function verifySessionFromCookieHeader(
  cookieHeader: string | null | undefined,
): Promise<Session | null> {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue
    return verifySessionValue(decodeURIComponent(part.slice(separator + 1)))
  }
  return null
}
