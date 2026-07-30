import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Every read and write against a user-scoped table must carry an explicit
// `user_id`, taken from `resolveAuth()`. There is no RLS: `sql` connects as the
// owning role, so the filter is the only thing keeping one user's rows away
// from another's.
//
// That rule was enforced by remembering it, and it fails in the worst way
// available: a forgotten filter is not a type error, not a test failure, and
// looks perfectly correct in a single-user local database (#219).

/** `// sql-scope-exempt: why` on the statement, or on a line above it. */
const EXEMPT = /sql-scope-exempt:\s*(\S.*)$/

/**
 * The tables a query must scope: those a migration gives a `user_id` column.
 *
 * Derived rather than listed so a table added by a later migration is covered
 * the day it lands -- a hardcoded list is a rule that silently stops applying.
 * `users` is correctly absent: it is keyed by `id`, and is how you resolve a
 * user in the first place.
 */
export function userScopedTables(migrationsDir) {
  const tables = new Set()
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))

  for (const file of files) {
    const sql = stripComments(readFileSync(join(migrationsDir, file), 'utf8'))
    // `create table x (` up to the matching depth-0 `)`.
    const re =
      /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\(/gi
    let m
    while ((m = re.exec(sql))) {
      const body = balancedBody(sql, re.lastIndex - 1)
      if (/\buser_id\b/i.test(body)) tables.add(m[1].toLowerCase())
    }
    // `alter table x add column user_id` counts too.
    const alter =
      /alter\s+table\s+([a-z_][a-z0-9_]*)[\s\S]{0,200}?add\s+column\s+(?:if\s+not\s+exists\s+)?user_id\b/gi
    while ((m = alter.exec(sql))) tables.add(m[1].toLowerCase())
  }
  return tables
}

function balancedBody(sql, openIndex) {
  let depth = 0
  for (let i = openIndex; i < sql.length; i++) {
    if (sql[i] === '(') depth++
    else if (sql[i] === ')' && --depth === 0) return sql.slice(openIndex + 1, i)
  }
  return sql.slice(openIndex)
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '')
}

/**
 * Whether a statement's static text names a user-scoped table without naming
 * `user_id` anywhere in it.
 *
 * Only the static text is examined, which is exactly right: `where user_id =
 * ${userId}` puts `user_id` in the static half and the value in the parameter,
 * so a query cannot pass this by interpolating the column name -- and could not
 * anyway, since `postgres` parameterises interpolations rather than splicing
 * them. An insert that supplies `user_id` in its column list passes too: the
 * row is scoped, which is the property being checked, not the clause used.
 *
 * Exported for the unit test; the rule below is the thin wrapper.
 */
export function unscopedTablesIn(statementText, tables) {
  const text = stripComments(statementText).toLowerCase()
  if (/\buser_id\b/.test(text)) return []
  return [...tables].filter((t) => new RegExp(`\\b${t}\\b`).test(text))
}

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'require an explicit user_id in any sql`` statement naming a user-scoped table',
    },
    schema: [
      {
        type: 'object',
        properties: { migrationsDir: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    messages: {
      unscoped:
        "This statement touches `{{tables}}` without a `user_id`. There is no RLS, so an unscoped query reads or writes every user's rows. Add the filter, or annotate it `// sql-scope-exempt: <why>` if the id was derived server-side.",
      noReason:
        'A `sql-scope-exempt` needs a reason after the colon -- the exemptions are the documentation of where this rule is knowingly bent.',
    },
  },

  create(context) {
    const dir = context.options[0]?.migrationsDir ?? 'migrations'
    const tables = userScopedTables(dir)
    const source = context.sourceCode ?? context.getSourceCode()

    return {
      TaggedTemplateExpression(node) {
        if (!isSqlTag(node)) return
        // A fragment interpolated into a larger statement is checked as part of
        // that statement, not on its own -- `sql`and status in ${...}`` names no
        // table and a bare `where` clause has nothing to scope by itself.
        if (isSqlTag(node.parent?.parent)) return

        const text = statementText(node, source)
        const offenders = unscopedTablesIn(text, tables)
        if (offenders.length === 0) return

        const exemption = exemptionFor(node, source)
        if (exemption) {
          if (!exemption.reason)
            context.report({ node: exemption.comment, messageId: 'noReason' })
          return
        }

        context.report({
          node,
          messageId: 'unscoped',
          data: { tables: offenders.join(', ') },
        })
      },
    }
  },
}

function isSqlTag(node) {
  return (
    node?.type === 'TaggedTemplateExpression' &&
    node.tag.type === 'Identifier' &&
    node.tag.name === 'sql'
  )
}

/**
 * A statement's full static text, following interpolated fragments.
 *
 * Queries here are composed: Activity builds a scoped `where`, folds it into a
 * `windowed`, and interpolates that into the page and count queries. Reading
 * only the outermost template would call all three unscoped and push a real,
 * correctly-scoped query onto the exemption list -- which is how an exemption
 * list stops meaning anything. So an interpolated `sql` fragment is inlined,
 * whether it appears literally or through a local binding.
 */
function statementText(node, source, seen = new Set()) {
  if (seen.has(node)) return ''
  seen.add(node)

  const parts = [node.quasi.quasis.map((q) => q.value.raw).join(' ')]
  for (const expr of node.quasi.expressions) {
    for (const frag of resolveFragments(expr, source)) {
      parts.push(statementText(frag, source, seen))
    }
  }
  return parts.join(' ')
}

/** The `sql` templates an interpolated expression can stand for. */
function resolveFragments(expr, source) {
  if (isSqlTag(expr)) return [expr]

  // `${cond ? sql`a` : sql`b`}` -- both branches are part of the statement.
  if (expr.type === 'ConditionalExpression') {
    return [expr.consequent, expr.alternate].flatMap((e) =>
      resolveFragments(e, source),
    )
  }

  if (expr.type === 'Identifier') {
    const init = bindingInit(expr, source)
    return init ? resolveFragments(init, source) : []
  }

  return []
}

/** The initialiser of a `const x = ...` the identifier resolves to. */
function bindingInit(identifier, source) {
  let scope = source.getScope(identifier)
  while (scope) {
    const variable = scope.variables.find((v) => v.name === identifier.name)
    if (variable) {
      const def = variable.defs[0]
      return def?.node?.type === 'VariableDeclarator' ? def.node.init : null
    }
    scope = scope.upper
  }
  return null
}

/**
 * An exemption comment inside the statement, or above it.
 *
 * "Above it" has to mean above any of the wrappers the statement sits in --
 * `await`, a `first(...)` call, the `const` it is assigned to. A comment
 * written directly above the query is not before the *template* node; it is
 * before whichever ancestor starts that line, so the whole chain is searched.
 */
function exemptionFor(node, source) {
  const candidates = [...source.getCommentsInside(node)]
  for (let cur = node; cur; cur = cur.parent) {
    candidates.push(...source.getCommentsBefore(cur))
    if (/Statement|Declaration/.test(cur.type)) break
  }

  for (const comment of candidates) {
    const m = EXEMPT.exec(comment.value)
    if (m) return { comment, reason: m[1].trim() }
    if (comment.value.includes('sql-scope-exempt'))
      return { comment, reason: '' }
  }
  return null
}

export default { rules: { 'sql-user-scoping': rule } }
