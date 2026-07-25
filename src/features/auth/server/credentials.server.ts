import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { sql } from '@/lib/server/db.server'

// Password hashing and verification. Server-only -- `node:crypto` is not
// available on the Edge runtime, which is why `../session` deliberately holds
// no import of this file.
//
// Ported from ~/repos/bootsy/src/features/auth/credentials.ts. Keep the scrypt
// call shape (16-byte salt, 64-byte key, no options object) identical to
// scripts/hash-lib.mjs, or hashes written by the provisioning script will not
// verify here and the failure looks like a wrong password.

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

// A fixed, valid-shaped hash to verify against when no user row matches, so a
// login attempt costs the same time whether or not the email is registered.
// Without it, "unknown email" returns fast and "known email, wrong password"
// returns slow, which enumerates accounts.
const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function matchesHash(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(':')
  if (!salt || !hashHex) return false

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  const storedKey = Buffer.from(hashHex, 'hex')
  if (derivedKey.length !== storedKey.length) return false

  return timingSafeEqual(derivedKey, storedKey)
}

/** Returns the user id on success, or null on any failure. */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<string | null> {
  const [user] = await sql<Array<{ id: string; passwordHash: string }>>`
    select id, password_hash from users where email = ${email}
  `

  const isMatch = await matchesHash(password, user?.passwordHash ?? DUMMY_HASH)
  return isMatch && user ? user.id : null
}
