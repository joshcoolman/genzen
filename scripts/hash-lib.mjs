// Shared with src/features/auth/server/credentials.server.ts -- keep the scrypt
// call shape (16-byte salt, 64-byte key, no options object) identical on both
// sides, or password verification silently fails and looks like a wrong
// password.
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH)
  return `${salt}:${derivedKey.toString('hex')}`
}
