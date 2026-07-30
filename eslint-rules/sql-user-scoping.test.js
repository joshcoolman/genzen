import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin, {
  unscopedTablesIn,
  userScopedTables,
} from './sql-user-scoping.js'

// A mechanism that cannot be shown to catch the mistake is not a mechanism
// (#219). These run the real rule through ESLint, not a stand-in: the
// deliberately unscoped query must fail, and every shape the codebase legitimately
// uses must pass.

const linter = new Linter()

function lint(code) {
  return linter.verify(code, {
    plugins: { genzen: plugin },
    rules: { 'genzen/sql-user-scoping': 'error' },
  })
}

describe('userScopedTables', () => {
  const tables = userScopedTables('migrations')

  it('finds the tables a migration gives a user_id', () => {
    expect(tables).toContain('user_images')
    expect(tables).toContain('canvases')
    expect(tables).toContain('canvas_images')
  })

  it('leaves out tables that have no user_id', () => {
    // `users` is keyed by `id` -- it is how you resolve a user, not a table of
    // one user's rows. Scoping it by `user_id` would be meaningless.
    expect(tables).not.toContain('users')
    expect(tables).not.toContain('fal_price_cache')
  })
})

describe('the rule fires on an unscoped query', () => {
  it('catches a plain select', () => {
    const messages = lint('const r = await sql`select id from user_images`')
    expect(messages).toHaveLength(1)
    expect(messages[0].message).toContain('user_images')
  })

  it('catches a query scoped by something that is not the user', () => {
    // The exact mistake: a filter that looks like scoping and is not.
    const messages = lint(
      'const r = await sql`select id from user_images where id = ${imageId}`',
    )
    expect(messages).toHaveLength(1)
  })

  it('catches an update', () => {
    const messages = lint(
      'await sql`update canvas_images set x = ${x} where image_id = ${id}`',
    )
    expect(messages).toHaveLength(1)
  })

  it('names every offending table', () => {
    const messages = lint(
      'await sql`select * from user_images join canvas_images on true`',
    )
    expect(messages[0].message).toContain('user_images')
    expect(messages[0].message).toContain('canvas_images')
  })
})

describe('the rule stays quiet on the shapes the codebase uses', () => {
  it('accepts a direct filter', () => {
    expect(
      lint('await sql`select id from user_images where user_id = ${userId}`'),
    ).toHaveLength(0)
  })

  it('accepts a filter composed through a fragment', () => {
    // Activity's shape: a scoped `where` folded into the real queries. Reading
    // only the outer template would call this unscoped and push a correct query
    // onto the exemption list.
    expect(
      lint(`
        const where = sql\`where user_id = \${userId} and source = 'ai_generated'\`
        const rows = await sql\`select id from user_images \${where}\`
      `),
    ).toHaveLength(0)
  })

  it('accepts a fragment folded through two levels', () => {
    expect(
      lint(`
        const where = sql\`where user_id = \${userId}\`
        const windowed = sql\`\${where} and created_at > now()\`
        const rows = await sql\`select id from user_images \${windowed}\`
      `),
    ).toHaveLength(0)
  })

  it('accepts a conditional fragment', () => {
    expect(
      lint(`
        const rows = await sql\`
          select id from user_images where user_id = \${userId}
          \${models ? sql\`and model in \${sql(models)}\` : sql\`\`}
        \`
      `),
    ).toHaveLength(0)
  })

  it('does not flag a bare fragment that names no table', () => {
    expect(lint('const f = sql`, title = ${title}`')).toHaveLength(0)
  })

  it('does not flag a table without a user_id column', () => {
    expect(
      lint('await sql`select id from users where email = ${email}`'),
    ).toHaveLength(0)
  })
})

describe('exemptions', () => {
  it('accepts one with a reason', () => {
    expect(
      lint(`
        // sql-scope-exempt: recordId came from a user_id-filtered select
        await sql\`update user_images set status = 'failed' where id = \${recordId}\`
      `),
    ).toHaveLength(0)
  })

  it('accepts one above an awaited call wrapper', () => {
    // How they actually appear: the comment is above `await`, inside `first(`,
    // so it is not "before" the template node itself.
    expect(
      lint(`
        const record = first(
          // sql-scope-exempt: server-derived id
          await sql\`select title from user_images where id = \${recordId}\`,
        )
      `),
    ).toHaveLength(0)
  })

  it('rejects one without a reason', () => {
    const messages = lint(`
      // sql-scope-exempt
      await sql\`select id from user_images\`
    `)
    expect(messages).toHaveLength(1)
    expect(messages[0].message).toContain('needs a reason')
  })
})

describe('unscopedTablesIn', () => {
  const tables = new Set(['user_images'])

  it('ignores a table named only in a comment', () => {
    expect(unscopedTablesIn('select 1 -- from user_images', tables)).toEqual([])
  })

  it('does not match a table name inside a longer identifier', () => {
    expect(
      unscopedTablesIn('select * from user_images_archive', tables),
    ).toEqual([])
  })
})
