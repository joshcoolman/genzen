import 'server-only'
import { sql } from './db.server'
import { modelTitleFor } from '#/features/ai-images/models'

/**
 * What the account overview aggregates (#406 phase 2).
 *
 * **There is no separate log table -- the generation ledger *is* `user_images`**,
 * with cost, model and timings inside `generation_metadata`. So this aggregates
 * in SQL rather than reusing `listActivity`, which paginates, does not
 * aggregate, and windows to the last three active days.
 *
 * **Video is counted.** `listActivity` filters `source = 'ai_generated'`, which
 * is exactly why video is invisible in Activity (#398); querying both sources
 * makes this the first surface where video spend shows up at all, without
 * waiting on that. It is broken out rather than folded in because it is the
 * pricier half by a wide margin.
 *
 * **Every figure is an estimate.** FAL's image queue returns no cost field, so
 * `provider_cost_is_estimate` is true on essentially every row and the totals
 * inherit that (#400). The UI must say so.
 */
export interface AccountStats {
  images: SourceTotals
  videos: SourceTotals
  /** Generations that failed, across both sources. */
  failures: {
    count: number
    /** Of everything attempted. 0 when nothing has been attempted. */
    rate: number
    latestError: string | null
    latestAt: string | null
  }
  /** Most-used first. Endpoints of one model are folded into one row. */
  models: Array<ModelUsage>
}

export interface SourceTotals {
  count: number
  /** Cents, and **fractional** -- a compute-seconds run is worth $0.0004 and
   *  rounding it to a whole cent stores nothing (#400). */
  spendCents: number
}

export interface ModelUsage {
  name: string
  count: number
  spendCents: number
}

/**
 * The cost of a row, in cents.
 *
 * Coalesced across both fields on purpose: images write `provider_cost_cents`
 * at completion and `estimated_cost_cents` at submit, video only ever writes
 * the latter. Reading one field alone silently drops a whole source.
 *
 * `numeric`, not `int`: since #400 a compute-seconds model records a fraction
 * of a cent, and an integer cast would truncate the cheap tier to zero.
 */
const COST_CENTS = sql`
  coalesce(
    (generation_metadata->>'provider_cost_cents')::numeric,
    (generation_metadata->>'estimated_cost_cents')::numeric,
    0
  )
`

/** Rows that represent a generation. An upload cost nothing and ran nothing. */
const GENERATED = sql`source in ('ai_generated', 'ai_video')`

interface TotalsRow {
  image_count: number
  video_count: number
  image_spend_cents: number
  video_spend_cents: number
  failed_count: number
  attempted_count: number
}

/** Exported for `foldModels`, which is the one piece here with real logic. */
export interface ModelRow {
  model_id: string | null
  model_label: string | null
  count: number
  spend_cents: number
}

export async function getAccountStats(userId: string): Promise<AccountStats> {
  const [[totals], modelRows, failureRows] = await Promise.all([
    // Soft-deleted rows are deliberately included. Trashing an image does not
    // refund it, and a spend figure that drops when you tidy up is a spend
    // figure nobody can reconcile against a card statement.
    sql<Array<TotalsRow>>`
      select
        count(*) filter (
          where source = 'ai_generated' and status = 'completed'
        )::int as image_count,
        count(*) filter (
          where source = 'ai_video' and status = 'completed'
        )::int as video_count,
        coalesce(sum(${COST_CENTS}) filter (
          where source = 'ai_generated' and status = 'completed'
        ), 0)::float8 as image_spend_cents,
        coalesce(sum(${COST_CENTS}) filter (
          where source = 'ai_video' and status = 'completed'
        ), 0)::float8 as video_spend_cents,
        count(*) filter (where status = 'failed')::int as failed_count,
        count(*)::int as attempted_count
      from user_images
      where user_id = ${userId} and ${GENERATED}
    `,
    // Per *endpoint*, folded to per model below: a model's text-to-image and
    // /edit endpoints are two ids for one name, and ranking them separately
    // would split a daily driver across two rows and rank neither honestly.
    sql<Array<ModelRow>>`
      select
        coalesce(
          generation_metadata->>'fal_model_id',
          generation_metadata->>'model'
        ) as model_id,
        generation_metadata->>'model_label' as model_label,
        count(*)::int as count,
        coalesce(sum(${COST_CENTS}), 0)::float8 as spend_cents
      from user_images
      where user_id = ${userId} and ${GENERATED} and status = 'completed'
      group by 1, 2
    `,
    sql<Array<{ generation_error: string | null; created_at: string }>>`
      select generation_error, to_json(created_at)#>>'{}' as created_at
      from user_images
      where user_id = ${userId} and ${GENERATED} and status = 'failed'
      order by created_at desc
      limit 1
    `,
  ])

  // `.at(0)` rather than a destructure: the row type says an element is always
  // there, and for a `limit 1` over a table that may hold no failures at all it
  // simply is not.
  const latestFailure = failureRows.at(0)

  return {
    images: {
      count: totals.image_count,
      spendCents: totals.image_spend_cents,
    },
    videos: {
      count: totals.video_count,
      spendCents: totals.video_spend_cents,
    },
    failures: {
      count: totals.failed_count,
      rate:
        totals.attempted_count > 0
          ? totals.failed_count / totals.attempted_count
          : 0,
      latestError: latestFailure?.generation_error ?? null,
      latestAt: latestFailure?.created_at ?? null,
    },
    models: foldModels(modelRows),
  }
}

/**
 * Endpoints to models, ranked by use.
 *
 * The name is resolved here rather than in SQL because it takes two different
 * routes: an image row carries an endpoint id that `modelTitleFor` resolves,
 * and a video row carries the label its submit wrote, because the video lineup
 * is route-owned (`app/(authenticated)/video/models.ts`) and a `.server.ts`
 * module must not reach into a route folder to read it.
 */
export function foldModels(rows: Array<ModelRow>): Array<ModelUsage> {
  const byName = new Map<string, ModelUsage>()

  for (const row of rows) {
    const name =
      row.model_label ?? (row.model_id ? modelTitleFor(row.model_id) : null)
    if (!name) continue
    const existing = byName.get(name)
    if (existing) {
      existing.count += row.count
      existing.spendCents += row.spend_cents
    } else {
      byName.set(name, {
        name,
        count: row.count,
        spendCents: row.spend_cents,
      })
    }
  }

  return [...byName.values()].sort(
    (a, b) => b.count - a.count || b.spendCents - a.spendCents,
  )
}
