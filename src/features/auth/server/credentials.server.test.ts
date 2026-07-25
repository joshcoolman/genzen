import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword, verifyCredentials } from './credentials.server'
import { sql } from '@/lib/server/db.server'

// Runs against the local Postgres from docker-compose (DATABASE_URL). Password
// verification is worth a real database rather than a mock: the failure mode
// being guarded against -- a hash written by scripts/hash-lib.mjs that
// credentials.server.ts cannot verify -- only shows up end to end.

const EMAIL = `${randomUUID()}@example.com`
const PASSWORD = 'correct-horse-battery-staple'
let userId: string

beforeAll(async () => {
  const [user] = await sql<Array<{ id: string }>>`
    insert into users (email, password_hash)
    values (${EMAIL}, ${await hashPassword(PASSWORD)})
    returning id
  `
  userId = user.id
})

afterAll(async () => {
  await sql`delete from users where id = ${userId}`
  await sql.end()
})

describe('credentials', () => {
  it('accepts the correct email and password', async () => {
    expect(await verifyCredentials(EMAIL, PASSWORD)).toBe(userId)
  })

  it('rejects the wrong password', async () => {
    expect(await verifyCredentials(EMAIL, 'wrong-password')).toBeNull()
  })

  it('rejects an unregistered email', async () => {
    expect(await verifyCredentials('nobody@example.com', PASSWORD)).toBeNull()
  })

  it('produces a different hash for the same password each time', async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD))
  })

  // The failure this guards against: scripts/hash-lib.mjs and this module each
  // hold their own scrypt call, and if the two drift (salt length, key length,
  // an options object on one side) every provisioned login breaks and the app
  // reports it as a wrong password. Provision the way the script does, verify
  // the way the app does.
  it('verifies a hash written by scripts/hash-lib.mjs', async () => {
    const { hashPassword: scriptHashPassword } =
      await import('../../../../scripts/hash-lib.mjs')
    const email = `${randomUUID()}@example.com`
    const [user] = await sql<Array<{ id: string }>>`
      insert into users (email, password_hash)
      values (${email}, ${await scriptHashPassword(PASSWORD)})
      returning id
    `
    try {
      expect(await verifyCredentials(email, PASSWORD)).toBe(user.id)
      expect(await verifyCredentials(email, 'wrong-password')).toBeNull()
    } finally {
      await sql`delete from users where id = ${user.id}`
    }
  })
})
