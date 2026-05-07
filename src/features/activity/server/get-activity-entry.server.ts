import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type {
  ActivityEntryDetail,
  ActivityGenerationMetadata,
  ActivityReferenceImage,
  GenerationStatus,
} from '../types'
import { requireAuth } from '@/lib/server/auth.server'
import { CREDIT_COSTS, DOLLARS_PER_CREDIT } from '@/features/credits/types'
import { getModelName } from '@/features/ai-images/models'
import { getVideoModelName } from '@/features/ai-video/video-models'

interface GetActivityEntryInput {
  accessToken: string
  id: string
}

interface DetailRow {
  id: string
  source: string
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  width: number | null
  height: number | null
  status: GenerationStatus
  generation_metadata: unknown
  generation_error: string | null
  created_at: string
  deleted_at: string | null
}

const CENTS_PER_CREDIT = Math.round(DOLLARS_PER_CREDIT * 100)

function meta(row: {
  generation_metadata: unknown
}): ActivityGenerationMetadata {
  return (row.generation_metadata ?? {}) as ActivityGenerationMetadata
}

function rawMetaJson(row: { generation_metadata: unknown }): string {
  try {
    return JSON.stringify(row.generation_metadata ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function computeDurationMs(m: ActivityGenerationMetadata): number | null {
  if (!m.submitted_at) return null
  const end = m.completed_at ?? m.failed_at
  if (!end) return null
  const delta = new Date(end).getTime() - new Date(m.submitted_at).getTime()
  return Number.isFinite(delta) && delta >= 0 ? delta : null
}

function computeUserCostCents(m: ActivityGenerationMetadata): number | null {
  const gt = m.generation_type
  if (!gt) return null
  const credits = (CREDIT_COSTS as Record<string, number | undefined>)[gt]
  if (credits == null) return null
  return credits * CENTS_PER_CREDIT
}

function resolveThumbnailPath(
  row: Pick<DetailRow, 'source' | 'storage_path'>,
  m: ActivityGenerationMetadata,
): string | null {
  if (row.source === 'ai_video') return m.thumbnail_path ?? null
  return row.storage_path ?? null
}

function resolveModelName(
  source: string,
  modelId: string | null | undefined,
): string {
  if (!modelId) return 'Unknown'
  if (source === 'ai_video') return getVideoModelName(modelId)
  return getModelName(modelId)
}

function deriveProvider(m: ActivityGenerationMetadata): string | null {
  if (m.provider === 'google') return 'Google Vertex AI'
  if (m.provider === 'openai') return 'OpenAI'
  if (m.fal_model_id ?? m.model?.startsWith('fal-ai/')) return 'FAL AI'
  return null
}

function extractErrorMessage(
  m: ActivityGenerationMetadata,
  generationError: string | null,
): string | null {
  if (generationError) return generationError
  const e = m.error
  if (!e) return null
  if (typeof e === 'string') return e
  return e.message ?? null
}

export const getActivityEntry = createServerFn({ method: 'GET' })
  .inputValidator((data: GetActivityEntryInput) => data)
  .handler(async ({ data }): Promise<ActivityEntryDetail | null> => {
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

    const { data: row, error } = await supabase
      .from('user_images')
      .select(
        'id, source, storage_path, file_name, mime_type, file_size, width, height, status, generation_metadata, generation_error, created_at, deleted_at',
      )
      .eq('id', data.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load activity entry: ${error.message}`)
    }
    if (!row) return null

    const r = row as DetailRow
    const m = meta(r)
    const kind: ActivityEntryDetail['kind'] =
      r.source === 'ai_video' ? 'video' : 'image'

    const refIds = Array.isArray(
      (m as { reference_image_ids?: unknown }).reference_image_ids,
    )
      ? (
          (m as { reference_image_ids?: Array<unknown> }).reference_image_ids ??
          []
        ).filter((v): v is string => typeof v === 'string')
      : []

    let referenceImages: Array<ActivityReferenceImage> = []
    if (refIds.length > 0) {
      const { data: refRows } = await supabase
        .from('user_images')
        .select('id, storage_path, deleted_at')
        .in('id', refIds)
        .eq('user_id', user.id)
      const byId = new Map<
        string,
        { storage_path: string | null; deleted_at: string | null }
      >()
      for (const rr of (refRows ?? []) as Array<{
        id: string
        storage_path: string | null
        deleted_at: string | null
      }>) {
        byId.set(rr.id, {
          storage_path: rr.storage_path,
          deleted_at: rr.deleted_at,
        })
      }
      // Preserve metadata order; missing refs become null storage paths.
      referenceImages = refIds.map((id) => {
        const found = byId.get(id)
        return {
          id,
          storagePath: found?.storage_path ?? null,
          isDeleted: found?.deleted_at != null,
        }
      })
    }

    return {
      id: r.id,
      kind,
      thumbnailPath: resolveThumbnailPath(r, m),
      prompt: m.prompt ?? '',
      model: m.model ?? null,
      modelName: resolveModelName(r.source, m.model),
      provider: deriveProvider(m),
      status: r.status,
      createdAt: r.created_at,
      submittedAt: m.submitted_at ?? null,
      completedAt: m.completed_at ?? null,
      failedAt: m.failed_at ?? null,
      durationMs: computeDurationMs(m),
      userCostCents: computeUserCostCents(m),
      providerCostCents: m.provider_cost_cents ?? null,
      isDeleted: r.deleted_at != null,
      errorMessage: extractErrorMessage(m, r.generation_error),
      storagePath: r.storage_path,
      fileName: r.file_name,
      mimeType: r.mime_type,
      fileSize: r.file_size,
      width: r.width,
      height: r.height,
      falUrl: m.fal_url ?? null,
      referenceImages,
      rawMetadataJson: rawMetaJson(r),
    }
  })
