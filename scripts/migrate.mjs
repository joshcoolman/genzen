// Applies migrations/*.sql not yet recorded in schema_migrations, in filename
// order, each inside its own transaction so a failure leaves no half-applied
// migration behind.
//
// Ported from ~/repos/bootsy/scripts/migrate.mjs. No migration library: the
// whole contract is "run the files that have not run yet, in order, and record
// which ones did".
//
// Usage: pnpm db:migrate
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import postgres from 'postgres'

const ENV_LOCAL_PATH = new URL('../.env.local', import.meta.url)
if (existsSync(ENV_LOCAL_PATH)) process.loadEnvFile(ENV_LOCAL_PATH)

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error(
    'DATABASE_URL is not set. Run `pnpm local:up`, or set it in .env.local.',
  )
  process.exit(1)
}

// `create table if not exists` emits a NOTICE that the driver would otherwise
// print as a raw object on every run -- noise in front of the one line that
// matters ("applied N" / "up to date").
const sql = postgres(databaseUrl, { onnotice: () => {} })
const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url)

await sql`
  create table if not exists schema_migrations (
    id text primary key,
    applied_at timestamptz not null default now()
  )
`

const applied = new Set(
  (await sql`select id from schema_migrations`).map((row) => row.id),
)
const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()

let ran = 0
for (const file of files) {
  if (applied.has(file)) continue
  const contents = readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8')
  console.log(`apply ${file}`)
  await sql.begin(async (tx) => {
    await tx.unsafe(contents)
    await tx`insert into schema_migrations (id) values (${file})`
  })
  ran += 1
}

await sql.end()
console.log(ran === 0 ? 'up to date' : `applied ${ran} migration(s)`)
