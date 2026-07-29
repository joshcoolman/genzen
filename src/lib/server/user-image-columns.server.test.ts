import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The shape of `user_images` is asserted in three places that nothing forces to
// agree: the numbered migrations in `migrations/`, the select list in
// `user-image-columns.server.ts`, and `UserImageRow` in `#/lib/types/db`. Add or
// drop a column and you have to remember all three -- and the failure from
// forgetting is a column that silently reads as `undefined` at runtime, or a
// select list naming a column the table no longer has.
//
// This is the cheap version of what an ORM's generated types would give: parse
// the three, compare the sets, fail loudly on a mismatch. It reads the files as
// text rather than connecting to a database, so it runs in CI with no services.

const ROOT = new URL('../../../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8')

/** Columns `user_images` has after every migration has run: the `create table`
 *  block, less anything a later migration dropped. */
function migrationColumns(): Array<string> {
  const files = readdirSync(new URL('migrations/', ROOT))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const init = read(`migrations/${files[0]}`)
  const start = init.indexOf('create table user_images (')
  expect(
    start,
    'user_images table not found in the first migration',
  ).toBeGreaterThan(-1)
  const body = init.slice(start + 'create table user_images ('.length)
  const end = body.indexOf('\n);')
  const names = new Set<string>()
  for (const line of body.slice(0, end).split('\n')) {
    const m = /^ {2}([a-z_]+) /.exec(line)
    // Skip the trailing `constraint ...` entries, which are not columns.
    if (m?.[1] && m[1] !== 'constraint') names.add(m[1])
  }

  for (const file of files.slice(1)) {
    const sql = read(`migrations/${file}`)
    for (const m of sql.matchAll(
      /alter table user_images\s+drop column (?:if exists )?([a-z_]+)/g,
    )) {
      names.delete(m[1])
    }
  }

  return [...names].sort()
}

/** Column names the select list produces, accounting for `x as name` casts. */
function selectListColumns(): Array<string> {
  const src = read('src/lib/server/user-image-columns.server.ts')
  const body = src.slice(src.indexOf('return sql`') + 'return sql`'.length)
  const list = body.slice(0, body.indexOf('`'))
  const names = new Set<string>()
  for (const part of list.split(',')) {
    const text = part.trim()
    if (!text) continue
    const aliased = / as ([a-z_]+)$/.exec(text)
    names.add(aliased ? aliased[1] : text)
  }
  // `to_json(x)#>>'{}' as name` contains a comma-free cast, but the jsonb path
  // `'{}'` does not split -- anything left holding punctuation is a parse bug.
  for (const name of names) expect(name).toMatch(/^[a-z_]+$/)
  return [...names].sort()
}

/** Field names declared on `UserImageRow`. */
function rowTypeFields(): Array<string> {
  const src = read('src/lib/types/db.ts')
  const start = src.indexOf('export type UserImageRow = {')
  const body = src.slice(start)
  const end = body.indexOf('\n}')
  const names = new Set<string>()
  for (const line of body.slice(0, end).split('\n')) {
    const m = /^ {2}([a-z_]+)[?]?:/.exec(line)
    if (m?.[1]) names.add(m[1])
  }
  return [...names].sort()
}

describe('user_images shape', () => {
  it('the migration, the select list and the row type all agree', () => {
    const migration = migrationColumns()

    // Sanity: the parsers found something, so a regression that returns an
    // empty set cannot pass by comparing nothing to nothing.
    expect(migration.length).toBeGreaterThan(20)

    expect(selectListColumns()).toEqual(migration)
    expect(rowTypeFields()).toEqual(migration)
  })
})
