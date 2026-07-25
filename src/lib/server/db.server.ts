import postgres from 'postgres'

// The Postgres client for the post-#168 data layer. Server-only: the `.server`
// suffix keeps it out of any browser bundle, which is the whole point of the
// migration -- today 54 queries run in the browser against Supabase, guarded
// only by RLS.
//
// `transform: postgres.camel` maps snake_case columns to camelCase keys, so a
// converted call site keeps the shape it had under supabase-js and the diff
// stays about the query rather than about renaming every field.

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return url
}

// Reuse one pool across dev-server hot reloads -- each HMR re-evaluation of this
// module would otherwise open a fresh pool and strand the old one's connections
// idle until Postgres hits max_connections.
const globalForSql = globalThis as typeof globalThis & {
  __genzenSql?: ReturnType<typeof postgres>
}

export const sql = (globalForSql.__genzenSql ??= postgres(getDatabaseUrl(), {
  transform: postgres.camel,
}))
