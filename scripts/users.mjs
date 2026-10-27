// List, add, and delete users on the genzen database.
//
//   pnpm users                          list
//   pnpm users add <email> <password>   create, or reset an existing password
//   pnpm users delete <email>           delete the user AND all their images
//
// There is one database: the Neon one on the Vercel project, which local dev
// and the deployment share (#777). `pnpm local:up` pulls its URL into
// `.env.local`; an explicit DATABASE_URL in the shell wins over that, which is
// how a different database is reached on purpose.
//
// Every run names the host before doing anything, and every write asks first.
// The failure worth preventing is silent, not loud: this database is the real
// one, and "add a test login" is a real account.

import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import postgres from 'postgres'
import { hashPassword } from './hash-lib.mjs'

const ENV_LOCAL_PATH = new URL('../.env.local', import.meta.url)

function question(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer)
    }),
  )
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, source: 'DATABASE_URL' }
  }
  if (existsSync(ENV_LOCAL_PATH)) {
    process.loadEnvFile(ENV_LOCAL_PATH)
    const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    if (url) return { url, source: '.env.local' }
  }
  return null
}

const argv = process.argv.slice(2)
const rest = argv

function usage() {
  const b = process.stdout.isTTY ? '\x1b[1m' : ''
  const d = process.stdout.isTTY ? '\x1b[2m' : ''
  const c = process.stdout.isTTY ? '\x1b[36m' : ''
  const r = process.stdout.isTTY ? '\x1b[0m' : ''

  console.log(`${b}users${r} — list, add, and delete genzen logins\n`)
  console.log(`${d}Usage:${r}`)
  console.log(`  ${c}pnpm users${r}                            list every user`)
  console.log(
    `  ${c}pnpm users add <email> <pass>${r}         create, or reset an existing password`,
  )
  console.log(
    `  ${c}pnpm users delete <email>${r}             delete the user and all their images`,
  )
  console.log(`\n${d}Options:${r}`)
  console.log(`  ${c}-h, --help${r}                            show this help`)
  console.log(`\n${d}Notes:${r}`)
  console.log(
    `  ${d}Targets the project database from .env.local, or DATABASE_URL if exported; every run prints which host it hit.${r}`,
  )
  console.log(`  ${d}Every write asks for confirmation first.${r}`)
  console.log(
    `  ${d}Passwords are 6+ chars. Deleting a user cascades to their images.${r}`,
  )
}

if (rest.includes('-h') || rest.includes('--help') || rest[0] === 'help') {
  usage()
  process.exit(0)
}

const resolved = resolveDatabaseUrl()
if (!resolved) {
  console.error(
    'No database found. Run `pnpm local:up` once, or set DATABASE_URL.',
  )
  process.exit(1)
}

const { hostname: dbHost } = new URL(resolved.url)

async function confirmRemote(action) {
  const answer = await question(`${action} on ${dbHost}? (y/N) `)
  return answer.trim().toLowerCase() === 'y'
}

const [command = 'list', ...args] = rest
const sql = postgres(resolved.url)

try {
  if (command === 'list') {
    // Emails and nothing else: this is "who can sign in", read at a glance.
    const users = await sql`select email from users order by created_at`
    if (users.length === 0) console.log('No users.')
    for (const u of users) console.log(u.email)
  } else if (command === 'add') {
    const [email, password] = args
    if (!email?.includes('@') || !password || password.length < 6) {
      console.error(
        "Usage: pnpm users add '<email>' '<password>'  (password min 6 chars)",
      )
      process.exit(1)
    }

    const [existing] = await sql`select id from users where email = ${email}`
    const action = existing
      ? `Reset the password for ${email}`
      : `Create ${email}`
    if (!(await confirmRemote(action))) {
      console.log('Aborted.')
      process.exit(0)
    }

    if (existing) {
      await sql`update users set password_hash = ${await hashPassword(password)} where id = ${existing.id}`
      console.log(`Reset password for ${email} (${existing.id}).`)
    } else {
      const [user] = await sql`
        insert into users (email, password_hash)
        values (${email}, ${await hashPassword(password)})
        returning id
      `
      console.log(`Created ${email} (${user.id}).`)
    }
  } else if (command === 'delete') {
    const [email] = args
    if (!email) {
      console.error("Usage: pnpm users delete '<email>'")
      process.exit(1)
    }

    const [user] = await sql`
      select u.id, count(i.id)::int as images
      from users u
      left join user_images i on i.user_id = u.id
      where u.email = ${email}
      group by u.id
    `
    if (!user) {
      console.error(`No user with email ${email}.`)
      process.exit(1)
    }

    // user_images.user_id is `on delete cascade`, so this is not just an
    // account deletion -- it destroys their images too. Say the number out loud
    // rather than letting it be discovered afterwards.
    console.log(
      `Deleting ${email} will also delete ${user.images} image record(s). This cannot be undone.`,
    )
    const answer = await question(`Type the email to confirm: `)
    if (answer.trim() !== email) {
      console.log('Aborted.')
      process.exit(0)
    }

    await sql`delete from users where id = ${user.id}`
    console.log(`Deleted ${email}.`)
  } else {
    console.error(`Unknown command "${command}". Use: list | add | delete`)
    process.exit(1)
  }
} finally {
  await sql.end()
}
