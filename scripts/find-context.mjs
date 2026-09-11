// Find the media behind "uploaded just now" or "generated yesterday". SQL
// values are parameters; prose, titles and prompts are never executable code.
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import postgres from 'postgres'
import { loadContextEnvironment, validateTarget } from './inspect-activity.mjs'

export function searchOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      query: { type: 'string' },
      day: { type: 'string' },
      timezone: {
        type: 'string',
        default: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      source: { type: 'string' },
      user: { type: 'string' },
      origin: { type: 'string' },
      limit: { type: 'string', default: '20' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (
    values.day &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(values.day) ||
      !Number.isFinite(Date.parse(values.day)) ||
      new Date(values.day).toISOString().slice(0, 10) !== values.day)
  ) {
    throw new Error('--day must be a calendar date: YYYY-MM-DD.')
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: values.timezone })
  } catch {
    throw new Error(
      '--timezone must be an IANA timezone, such as America/New_York.',
    )
  }
  if (
    values.source &&
    ![
      'uploaded',
      'upload',
      'ai_generated',
      'ai_video',
      'ai_video_frame',
    ].includes(values.source)
  ) {
    throw new Error(
      '--source must be uploaded, ai_generated, ai_video, or ai_video_frame.',
    )
  }
  const limit = Number(values.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('--limit must be 1–100.')
  return {
    ...values,
    source: values.source === 'uploaded' ? 'upload' : values.source,
    limit,
  }
}

export async function findContext(sql, options, env) {
  const origin = options.origin || env.APP_URL || 'http://localhost:3000'
  const target = validateTarget(new URL(origin), env)
  return sql.begin('isolation level repeatable read read only', async (tx) => {
    const email = options.user
    // Never quietly combine several accounts' timelines. In a single-account
    // installation the only user is unambiguous, including on deployments.
    const users = email
      ? await tx`select id, email from users where lower(email) = lower(${email})`
      : await tx`select id, email from users order by created_at limit 2`
    if (!email && users.length > 1) {
      const accounts = await tx`
        select u.email, latest.created_at as latest_media_at
        from users u
        left join lateral (
          select created_at from user_images where user_id = u.id
          order by created_at desc limit 1
        ) latest on true
        order by latest.created_at desc nulls last
        limit 20
      `
      return {
        target,
        accounts,
        needsAccount: true,
        instructions:
          'Multiple accounts exist. Use the account established by the conversation or inspect plausible accounts with --user <email> to locate the described item. Do not assume LOCAL_DEV_EMAIL is the signed-in user, mix timelines, or claim no results before selecting an account.',
      }
    }
    if (users.length !== 1)
      throw new Error(
        'Could not select one account. Supply --user <email> for the intended account.',
      )
    const user = users[0]
    const query = options.query?.trim()
    const pattern = query ? `%${query.replace(/[\\%_]/g, '\\$&')}%` : null
    const rows = await tx`
      select id, title, description, file_name, source, origin, status, created_at, deleted_at,
             mime_type, width, height, generation_error,
             generation_metadata->>'prompt' as prompt,
             generation_metadata->>'model' as model,
             generation_metadata->>'model_label' as model_label
      from user_images
      where user_id = ${user.id}
        ${options.source ? tx`and source = ${options.source}` : tx``}
        ${
          options.day
            ? tx`and created_at >= (${options.day}::date::timestamp at time zone ${options.timezone})
          and created_at < ((${options.day}::date + 1)::timestamp at time zone ${options.timezone})`
            : tx``
        }
        ${
          pattern
            ? tx`and (title ilike ${pattern} or description ilike ${pattern} or file_name ilike ${pattern}
          or generation_metadata->>'prompt' ilike ${pattern})`
            : tx``
        }
      order by created_at desc, id desc
      limit ${options.limit + 1}
    `
    return {
      retrievedAt: new Date().toISOString(),
      target,
      account: user.email,
      filters: {
        day: options.day ?? null,
        timezone: options.timezone,
        query: query ?? null,
        source: options.source ?? null,
        limit: options.limit,
      },
      hasMore: rows.length > options.limit,
      entries: rows.slice(0, options.limit).map((row) => ({
        ...row,
        createdAtLocal: new Intl.DateTimeFormat('en-CA', {
          timeZone: options.timezone,
          dateStyle: 'short',
          timeStyle: 'long',
        }).format(new Date(row.created_at)),
        contextUrl: `${target.origin}/activity?entry=${row.id}`,
      })),
      instructions:
        'These are candidates, not inspected media. Run pnpm context:inspect with the chosen contextUrl or ID and open its media before describing image contents. Text search matches titles, descriptions, filenames and prompts, not image pixels. If ambiguous, inspect likely candidates or ask one narrow question. Deleted records are included.',
    }
  })
}

export async function main(args = process.argv.slice(2)) {
  const options = searchOptions(args)
  if (options.help) {
    console.log(
      'Usage: pnpm context:find [--day YYYY-MM-DD] [--timezone America/New_York]\n  [--query text] [--source uploaded|ai_generated|ai_video] [--limit 20]\n  [--user email] [--origin https://deployment]\nDefaults to the latest 20 media records, including uploads and deleted items. Read-only.',
    )
    return
  }
  loadContextEnvironment()
  // Validate before opening a connection, including configuration failures.
  validateTarget(
    new URL(options.origin || process.env.APP_URL || 'http://localhost:3000'),
    process.env,
  )
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
    connection: { statement_timeout: 15000 },
  })
  try {
    console.log(
      JSON.stringify(await findContext(sql, options, process.env), null, 2),
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      error.constructor === Error && !error.code
        ? error.message
        : `Lookup failed (${error.code ?? error.name}). Check arguments and database configuration.`,
    )
    process.exitCode = 1
  })
}
