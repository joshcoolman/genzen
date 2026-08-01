// List, add, and delete users, against local or a deployed database.
//
//   pnpm users                          list
//   pnpm users add <email> <password>   create, or reset an existing password
//   pnpm users delete <email>           delete the user AND all their images
//
//   --local                             target the docker stack instead
//
// Defaults to the DEPLOYED database, because managing deployed logins is what
// this exists for -- `pnpm local:up` already makes a local one for you. Order:
// an explicit DATABASE_URL, else Railway's public proxy, else .env.local.
// `--local` skips Railway and uses .env.local.
//
// Every run names the target before doing anything, and writes to a non-local
// database ask first. The failure worth preventing is silent, not loud: a
// stale .env.local turns "add a local login" into a real account on production,
// and the reverse -- editing production while you meant to edit local -- is
// just as easy to do and harder to notice.

import { execFileSync } from 'node:child_process'
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

// The deployed DATABASE_URL points at postgres.railway.internal, which only
// resolves inside Railway. From a laptop the usable address is the public TCP
// proxy, so rebuild the URL from the proxy's host/port rather than reusing the
// service's own DATABASE_URL.
function resolveDeployedUrl() {
  const read = (args) => {
    try {
      return execFileSync('railway', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      return null
    }
  }

  const vars = read(['variables', '--service', 'Postgres', '--kv'])
  if (!vars) return null

  const get = (name) =>
    vars
      .split('\n')
      .find((line) => line.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim()

  const publicUrl = get('DATABASE_PUBLIC_URL')
  // Railway populates DATABASE_PUBLIC_URL with an empty host until a TCP proxy
  // exists, which parses as a URL but cannot connect. Treat that as absent.
  if (publicUrl) {
    try {
      if (new URL(publicUrl).hostname) return publicUrl
    } catch {
      /* fall through */
    }
  }
  return null
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, source: 'DATABASE_URL' }
  }

  if (!WANT_LOCAL) {
    const deployed = resolveDeployedUrl()
    if (deployed) return { url: deployed, source: 'Railway (public proxy)' }
  }

  if (existsSync(ENV_LOCAL_PATH)) {
    process.loadEnvFile(ENV_LOCAL_PATH)
    if (process.env.DATABASE_URL) {
      return { url: process.env.DATABASE_URL, source: '.env.local' }
    }
  }

  return null
}

const argv = process.argv.slice(2)
const WANT_LOCAL = argv.includes('--local')
const rest = argv.filter((a) => a !== '--local')

function usage() {
  const b = process.stdout.isTTY ? '\x1b[1m' : ''
  const d = process.stdout.isTTY ? '\x1b[2m' : ''
  const c = process.stdout.isTTY ? '\x1b[36m' : ''
  const r = process.stdout.isTTY ? '\x1b[0m' : ''

  console.log(`${b}users${r} — list, add, and delete genzen logins\n`)
  console.log(`${d}Usage:${r}`)
  console.log(`  ${c}pnpm users${r}                            list every user`)
  console.log(`  ${c}pnpm users add <email> <pass>${r}         create, or reset an existing password`)
  console.log(`  ${c}pnpm users delete <email>${r}             delete the user and all their images`)
  console.log(`\n${d}Options:${r}`)
  console.log(`  ${c}--local${r}                               use the docker stack instead of the deployed database`)
  console.log(`  ${c}-h, --help${r}                            show this help`)
  console.log(`\n${d}Notes:${r}`)
  console.log(`  ${d}Targets the DEPLOYED database by default; every run prints which host it hit.${r}`)
  console.log(`  ${d}Writes to a non-local database ask for confirmation first.${r}`)
  console.log(`  ${d}Passwords are 6+ chars. Deleting a user cascades to their images.${r}`)
}

if (rest.includes('-h') || rest.includes('--help') || rest[0] === 'help') {
  usage()
  process.exit(0)
}

const resolved = resolveDatabaseUrl()
if (!resolved) {
  console.error(
    'No database found. Run `pnpm local:up` for a local stack, or set DATABASE_URL.',
  )
  process.exit(1)
}

const { hostname: dbHost } = new URL(resolved.url)
const isLocal = dbHost === 'localhost' || dbHost === '127.0.0.1'
console.log(
  `database: ${dbHost}${isLocal ? ' (local docker stack)' : ''}  [${resolved.source}]\n`,
)

async function confirmRemote(action) {
  if (isLocal) return true
  const answer = await question(`This is NOT localhost. ${action} on ${dbHost}? (y/N) `)
  return answer.trim().toLowerCase() === 'y'
}

const [command = 'list', ...args] = rest
const sql = postgres(resolved.url)

try {
  if (command === 'list') {
    const users = await sql`
      select u.id, u.email, u.display_name, u.created_at,
             count(i.id)::int as images
      from users u
      left join user_images i on i.user_id = u.id
      group by u.id
      order by u.created_at
    `
    if (users.length === 0) {
      console.log('No users.')
    } else {
      for (const u of users) {
        const when = u.created_at.toISOString().slice(0, 10)
        const name = u.display_name ? ` (${u.display_name})` : ''
        console.log(`${u.email}${name}  ${u.images} image(s)  since ${when}`)
      }
      console.log(`\n${users.length} user(s).`)
    }
  } else if (command === 'add') {
    const [email, password] = args
    if (!email?.includes('@') || !password || password.length < 6) {
      console.error("Usage: pnpm users add '<email>' '<password>'  (password min 6 chars)")
      process.exit(1)
    }

    const [existing] = await sql`select id from users where email = ${email}`
    const action = existing ? `Reset the password for ${email}` : `Create ${email}`
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
