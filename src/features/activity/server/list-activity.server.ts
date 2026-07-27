'use server'

import { TOTALS_ROW_CAP } from '../types'
import type {
  ActivityEntry,
  ActivityGenerationMetadata,
  GenerationStatus,
  ListActivityResult,
} from '../types'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'
import { getModelName } from '#/features/ai-images/models'

interface ListActivityInput {
  page: number
  pageSize: number
  models?: Array<string>
  statuses?: Array<GenerationStatus>
  dateFrom?: string | null
  dateTo?: string | null
}

interface Row {
  id: string
  source: string
  storage_path: string | null
  status: GenerationStatus
  generation_metadata: unknown
  created_at: string
  deleted_at: string | null
}

interface TotalsRow {
  status: GenerationStatus
  generation_metadata: unknown
}

function meta(row: {
  generation_metadata: unknown
}): ActivityGenerationMetadata {
  return (row.generation_metadata ?? {}) as ActivityGenerationMetadata
}

function computeDurationMs(m: ActivityGenerationMetadata): number | null {
  if (!m.submitted_at) return null
  const end = m.completed_at ?? m.failed_at
  if (!end) return null
  const delta = new Date(end).getTime() - new Date(m.submitted_at).getTime()
  return Number.isFinite(delta) && delta >= 0 ? delta : null
}

function resolveThumbnailPath(row: Pick<Row, 'storage_path'>): string | null {
  return row.storage_path ?? null
}

function resolveModelName(modelId: string | null | undefined): string {
  if (!modelId) return 'Unknown'
  return getModelName(modelId)
}

function deriveProvider(m: ActivityGenerationMetadata): string | null {
  if (m.fal_model_id ?? m.model?.startsWith('fal-ai/')) return 'FAL AI'
  return null
}

function extractErrorMessage(m: ActivityGenerationMetadata): string | null {
  const e = m.error
  if (!e) return null
  if (typeof e === 'string') return e
  return e.message ?? null
}

function parseEntry(row: Row): ActivityEntry {
  const m = meta(row)
  return {
    id: row.id,
    thumbnailPath: resolveThumbnailPath(row),
    prompt: m.prompt ?? '',
    model: m.model ?? null,
    modelName: resolveModelName(m.model),
    provider: deriveProvider(m),
    status: row.status,
    createdAt: row.created_at,
    submittedAt: m.submitted_at ?? null,
    completedAt: m.completed_at ?? null,
    failedAt: m.failed_at ?? null,
    durationMs: computeDurationMs(m),
    providerCostCents: m.provider_cost_cents ?? null,
    costIsEstimate: m.provider_cost_is_estimate === true,
    isDeleted: row.deleted_at != null,
    errorMessage: extractErrorMessage(m),
  }
}

export async function listActivity(
  data: ListActivityInput,
): Promise<ListActivityResult> {
  const { userId } = await resolveAuth()

  // One predicate, three queries. It was a chain of builder calls applied to
  // two query objects through a structurally-typed `applyFilters` helper --
  // the shape that helper existed to satisfy went with supabase-js.
  const where = sql`
    where user_id = ${userId}
      and source = 'ai_generated'
      ${
        data.models?.length
          ? sql`and generation_metadata->>'model' in ${sql(data.models)}`
          : sql``
      }
      ${data.statuses?.length ? sql`and status in ${sql(data.statuses)}` : sql``}
      ${data.dateFrom ? sql`and created_at >= ${data.dateFrom}` : sql``}
      ${data.dateTo ? sql`and created_at <= ${data.dateTo}` : sql``}
  `

  const offset = data.page * data.pageSize

  const [pageRows, totalsRows, [{ count }]] = await Promise.all([
    sql<Array<Row>>`
      select id, source, storage_path, status, generation_metadata,
             to_json(created_at)#>>'{}' as created_at,
             to_json(deleted_at)#>>'{}' as deleted_at
      from user_images
      ${where}
      order by created_at desc
      limit ${data.pageSize} offset ${offset}
    `,
    sql<Array<TotalsRow>>`
      select status, generation_metadata
      from user_images
      ${where}
      order by created_at desc
      limit ${TOTALS_ROW_CAP}
    `,
    sql<Array<{ count: number }>>`
      select count(*)::int as count from user_images ${where}
    `,
  ])

  const entries = pageRows.map(parseEntry)

  let totalDurationMs = 0
  let totalProviderCostCents = 0
  let totalsIncludeEstimates = false
  for (const r of totalsRows) {
    const m = meta(r)
    const dur = computeDurationMs(m)
    if (dur != null) totalDurationMs += dur
    if (m.provider_cost_cents != null) {
      totalProviderCostCents += m.provider_cost_cents
      if (m.provider_cost_is_estimate === true) totalsIncludeEstimates = true
    }
  }

  return {
    entries,
    total: count,
    totals: {
      count: totalsRows.length,
      totalDurationMs,
      totalProviderCostCents,
      totalsIncludeEstimates,
      exceedsCap: totalsRows.length >= TOTALS_ROW_CAP,
    },
  }
}
