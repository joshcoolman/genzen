import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { TOTALS_ROW_CAP } from '../types'
import type {
  ActivityEntry,
  ActivityGenerationMetadata,
  GenerationStatus,
  ListActivityResult,
} from '../types'
import { requireAuth } from '@/lib/server/auth.server'
import { getModelName } from '@/features/ai-images/models'

interface ListActivityInput {
  accessToken: string
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

export const listActivity = createServerFn({ method: 'GET' })
  .inputValidator((data: ListActivityInput) => data)
  .handler(async ({ data }): Promise<ListActivityResult> => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const applyFilters = <
      TQuery extends {
        eq: (...args: Array<unknown>) => TQuery
        in: (...args: Array<unknown>) => TQuery
        gte: (...args: Array<unknown>) => TQuery
        lte: (...args: Array<unknown>) => TQuery
      },
    >(
      q: TQuery,
    ): TQuery => {
      let out = q.eq('user_id', user.id).eq('source', 'ai_generated')
      if (data.models && data.models.length > 0) {
        out = out.in('generation_metadata->>model', data.models)
      }
      if (data.statuses && data.statuses.length > 0) {
        out = out.in('status', data.statuses)
      }
      if (data.dateFrom) out = out.gte('created_at', data.dateFrom)
      if (data.dateTo) out = out.lte('created_at', data.dateTo)
      return out
    }

    const offset = data.page * data.pageSize

    const pageQueryBase = supabase
      .from('user_images')
      .select(
        'id, source, storage_path, status, generation_metadata, created_at, deleted_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + data.pageSize - 1)

    const totalsQueryBase = supabase
      .from('user_images')
      .select('status, generation_metadata')
      .order('created_at', { ascending: false })
      .limit(TOTALS_ROW_CAP)

    const [pageResult, totalsResult] = await Promise.all([
      applyFilters(pageQueryBase as never),
      applyFilters(totalsQueryBase as never),
    ])

    const {
      data: pageRows,
      count,
      error: pageError,
    } = pageResult as {
      data: Array<Row> | null
      count: number | null
      error: { message: string } | null
    }
    if (pageError) {
      throw new Error(`Failed to list activity: ${pageError.message}`)
    }

    const { data: totalsRows, error: totalsError } = totalsResult as {
      data: Array<TotalsRow> | null
      error: { message: string } | null
    }
    if (totalsError) {
      throw new Error(`Failed to load activity totals: ${totalsError.message}`)
    }

    const entries = (pageRows ?? []).map(parseEntry)

    let totalDurationMs = 0
    let totalProviderCostCents = 0
    let totalsIncludeEstimates = false
    for (const r of totalsRows ?? []) {
      const m = meta(r)
      const dur = computeDurationMs(m)
      if (dur != null) totalDurationMs += dur
      if (m.provider_cost_cents != null) {
        totalProviderCostCents += m.provider_cost_cents
        if (m.provider_cost_is_estimate === true) totalsIncludeEstimates = true
      }
    }

    const total = count ?? 0
    return {
      entries,
      total,
      totals: {
        count: totalsRows?.length ?? 0,
        totalDurationMs,
        totalProviderCostCents,
        totalsIncludeEstimates,
        exceedsCap: (totalsRows?.length ?? 0) >= TOTALS_ROW_CAP,
      },
    }
  })
