import postgres from 'postgres'

// The Postgres client. Server-only: the `.server` suffix keeps it out of any
// browser bundle, which was the whole point of #168 -- 54 queries used to run
// in the browser against Supabase, guarded only by RLS. Nothing does now, and
// there is no RLS to fall back on, so every query carries its own `user_id`
// (checked by `eslint-rules/sql-user-scoping.js`).
//
// No `transform`, on purpose. #172 planned for `postgres.camel` on the theory
// that it would keep call sites close to their supabase-js shape. The opposite
// is true here: `SavedAiImage`, `Tables<'user_images'>` and every component
// that renders them are snake_case, because that is what PostgREST returned.
// Rows come back snake_case already, so no transform is the identity mapping
// and the diff stays about the query instead of renaming every field in the app.
//
// `postgres.camel` would also have been wrong in a way that does not announce
// itself: the preset bundles a *value* transform that recurses into json/jsonb
// and camelises the payload's keys too, so `generation_metadata.fal_model_id`
// would silently become `falModelId` everywhere the app reads a generation.
//
// Two shapes that do differ from PostgREST, and are handled at the call site:
//
//   * timestamptz arrives as a `Date`, not an ISO string. Where the value
//     crosses to the client as a string, select it as
//     `to_json(created_at)#>>'{}' as created_at`, which is ISO 8601.
//   * bigint and numeric arrive as strings, to avoid silent float rounding.
//     `file_size` and `unit_price` are wrapped in `Number()` where read.

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

export const sql = (globalForSql.__genzenSql ??= postgres(getDatabaseUrl()))

/**
 * The first row of a result, typed honestly.
 *
 * `sql<Array<T>>` resolves to `T[]`, so `const [row] = await sql...` gives a
 * `T` that is not there whenever the query matched nothing. Every guard written
 * against that -- `if (!row)`, `row?.storage_path` -- then reads to the linter
 * as dead code, which is how a real missing-row crash gets "tidied" away.
 */
export function first<T>(rows: Array<T>): T | undefined {
  return rows[0]
}

/**
 * A jsonb parameter from a value the app only knows as `unknown` --
 * `generation_metadata` patches, error blobs, colour palettes. `sql.json`
 * demands a structurally-checked `JSONValue`, which nothing on those paths has;
 * the column is jsonb and takes whatever serialises.
 */
export function jsonb(value: unknown) {
  return sql.json(value as Parameters<typeof sql.json>[0])
}
