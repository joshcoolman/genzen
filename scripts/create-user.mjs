// Creates a user row directly in Postgres, or resets an existing user's
// password. Until the signup flow is rebuilt on the new auth (#168), this is the
// only way to grant access -- there is no seeded user any more.
//
// Usage: pnpm auth:create-user '<email>' '<password>'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import postgres from 'postgres'
import { hashPassword } from './hash-lib.mjs'

const ENV_LOCAL_PATH = new URL('../.env.local', import.meta.url)
if (existsSync(ENV_LOCAL_PATH)) process.loadEnvFile(ENV_LOCAL_PATH)

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Run `pnpm local:up` first.')
  process.exit(1)
}

const [email, password] = process.argv.slice(2)
if (!email || !email.includes('@') || !password || password.length < 6) {
  console.error(
    "Usage: pnpm auth:create-user '<email>' '<password>'  (password min 6 chars)",
  )
  process.exit(1)
}

function question(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer)
    }),
  )
}

// Name the database before writing to it. The failure this prevents is silent:
// a .env.local still pointed at a deployed instance turns "make me a local
// login" into a real account on production. Local is silent, remote asks.
const { hostname: dbHost } = new URL(databaseUrl)
const isLocalDatabase = dbHost === 'localhost' || dbHost === '127.0.0.1'
console.log(
  `database: ${dbHost}${isLocalDatabase ? ' (local docker stack)' : ''}`,
)

if (!isLocalDatabase) {
  const confirmed = await question(
    `This is NOT localhost. Create/modify a user on ${dbHost}? (y/N) `,
  )
  if (confirmed.trim().toLowerCase() !== 'y') {
    console.log('Aborted.')
    process.exit(0)
  }
}

const sql = postgres(databaseUrl)

const [existingUser] = await sql`select id from users where email = ${email}`

if (existingUser) {
  const answer = await question(
    `User ${email} already exists. Overwrite password? (y/N) `,
  )
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('User unchanged.')
    await sql.end()
    process.exit(0)
  }
  await sql`update users set password_hash = ${await hashPassword(password)} where id = ${existingUser.id}`
  console.log(`Updated password for ${email} (${existingUser.id}).`)
} else {
  const [user] = await sql`
    insert into users (email, password_hash) values (${email}, ${await hashPassword(password)})
    returning id
  `
  console.log(`Created ${email} (${user.id}).`)
}

await sql.end()
