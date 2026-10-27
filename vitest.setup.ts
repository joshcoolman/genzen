// Makes the local Postgres reachable from tests that use it.
//
// Vitest does not read .env files into process.env (Vite only exposes them as
// import.meta.env), and server-side modules read process.env. Only the vars
// the auth/db tests need are copied across -- the storage client is mocked in
// its own test and must not find a real token here.
import { existsSync, readFileSync } from 'node:fs'

const NEEDED = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'AUTH_SESSION_SECRET']
const ENV_LOCAL = new URL('./.env.local', import.meta.url)

if (existsSync(ENV_LOCAL)) {
  for (const line of readFileSync(ENV_LOCAL, 'utf8').split('\n')) {
    const separator = line.indexOf('=')
    if (separator === -1 || line.trimStart().startsWith('#')) continue
    const key = line.slice(0, separator).trim()
    if (!NEEDED.includes(key) || process.env[key]) continue
    // `vercel env pull` quotes values; the postgres driver does not unquote.
    process.env[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
  }
}

// Placeholders where `.env.local` did not supply one -- a fresh clone, or CI,
// which has no such file. `db.server.ts` throws at *import* time without a
// DATABASE_URL, so a suite that only mocks `sql` still fails to load.
//
// This is a real defect CI found on its first run (#227): the tests passed
// locally only because a developer's `.env.local` happened to be sitting there.
// A value is enough -- nothing in the suite opens a connection, and one that
// tried would fail loudly against this host rather than silently reach a real
// database.
process.env.DATABASE_URL ??= 'postgres://vitest:vitest@127.0.0.1:1/vitest'
process.env.AUTH_SESSION_SECRET ??= 'vitest-not-a-real-secret'
