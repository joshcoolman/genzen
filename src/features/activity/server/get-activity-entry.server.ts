'use server'

import type {
  ActivityEntryDetail,
  ActivityGenerationMetadata,
  ActivityReferenceImage,
  GenerationStatus,
} from '../types'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { getModelName } from '#/features/ai-images/models'

interface GetActivityEntryInput {
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

function resolveThumbnailPath(
  row: Pick<DetailRow, 'storage_path'>,
): string | null {
  return row.storage_path ?? null
}

function resolveModelName(modelId: string | null | undefined): string {
  if (!modelId) return 'Unknown'
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

export async function getActivityEntry(
  data: GetActivityEntryInput,
): Promise<ActivityEntryDetail | null> {
  const { userId } = await resolveAuth()

  // `file_size` is bigint and the timestamps are timestamptz; the casts keep
  // `DetailRow`'s number and ISO-string shape, which the driver would otherwise
  // hand back as a string and a `Date`.
  const row = first(
    await sql<Array<DetailRow>>`
    select id, source, storage_path, file_name, mime_type,
           file_size::float8 as file_size,
           width, height, status, generation_metadata, generation_error,
           to_json(created_at)#>>'{}' as created_at,
           to_json(deleted_at)#>>'{}' as deleted_at
    from user_images
    where id = ${data.id} and user_id = ${userId}
  `,
  )

  if (!row) return null

  const r = row
  const m = meta(r)

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
    const refRows = await sql<
      Array<{
        id: string
        storage_path: string | null
        deleted_at: Date | null
      }>
    >`
      select id, storage_path, deleted_at from user_images
      where id in ${sql(refIds)} and user_id = ${userId}
    `
    const byId = new Map<
      string,
      { storage_path: string | null; deleted_at: Date | null }
    >()
    for (const rr of refRows) {
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
    thumbnailPath: resolveThumbnailPath(r),
    prompt: m.prompt ?? '',
    model: m.model ?? null,
    modelName: resolveModelName(m.model),
    provider: deriveProvider(m),
    status: r.status,
    createdAt: r.created_at,
    submittedAt: m.submitted_at ?? null,
    completedAt: m.completed_at ?? null,
    failedAt: m.failed_at ?? null,
    durationMs: computeDurationMs(m),
    providerCostCents: m.provider_cost_cents ?? null,
    costIsEstimate: m.provider_cost_is_estimate === true,
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
}
