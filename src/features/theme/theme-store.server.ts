import { THEME_CORE_KEYS, isHexColor } from './derive'
import type { ThemeCore } from './derive'
import { first, jsonb, sql } from '#/lib/server/db.server'

/* Reads and writes the one row per user. `.server.ts` rather than a plain name:
 * it imports `db.server`, so a client component must never reach it -- which is
 * also why `index.ts` does not re-export it beside `derive`. Same lesson as
 * `features/auth`, where a barrel over both halves is how the Node half gets
 * pulled into the Edge half by accident. */

/** Narrows a JSONB blob to the core, or null.
 *
 *  The column is `jsonb` and the check constraint only guarantees the six keys
 *  are present -- not that their values are colors. A row written before a
 *  format change, or by hand, would otherwise reach `deriveTheme`, which throws
 *  on an unparseable color and would take the whole authenticated layout down
 *  with it. A theme is decoration; it must never be able to break the app it
 *  decorates, so an unreadable row degrades to "no customization". */
function parseCore(value: unknown): ThemeCore | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>

  for (const key of THEME_CORE_KEYS) {
    const channel = record[key]
    if (typeof channel !== 'string' || !isHexColor(channel)) return null
  }

  return Object.fromEntries(
    THEME_CORE_KEYS.map((key) => [key, record[key]]),
  ) as unknown as ThemeCore
}

/** The user's saved core, or null when they have never saved one.
 *
 *  Null is the ordinary case, not an error: no row means the app renders
 *  `tokens.css` untouched. */
export async function getUserTheme(userId: string): Promise<ThemeCore | null> {
  const rows = await sql<Array<{ core: unknown }>>`
    select core from user_theme where user_id = ${userId}
  `
  const row = first(rows)
  return row ? parseCore(row.core) : null
}

export async function saveUserTheme(
  userId: string,
  core: ThemeCore,
): Promise<void> {
  await sql`
    insert into user_theme (user_id, core)
    values (${userId}, ${jsonb(core)})
    on conflict (user_id) do update set core = excluded.core
  `
}

/** Back to no row at all -- the true uncustomized state, which writing a row of
 *  defaults would only imitate. */
export async function clearUserTheme(userId: string): Promise<void> {
  await sql`delete from user_theme where user_id = ${userId}`
}
