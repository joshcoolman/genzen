'use server'

import type {
  ActivityEntryDetail,
  ActivityGenerationMetadata,
  ActivitySource,
  GenerationStatus,
} from '#/features/activity/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { getModelName } from '#/features/ai-images/models'
import { refUsageNote } from '#/features/ai-images/ref-usage'
import { resolveGenerationInputs } from '#/features/ai-images/server/generation-inputs.server'

interface GetActivityEntryInput {
  id: string
}

interface DetailRow {
  id: string
  source: ActivitySource
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

/** `model_label` first -- see the note on the same function in
 *  `list-activity.action.ts`. A clip's endpoint is not in the image lineup. */
function resolveModelName(m: ActivityGenerationMetadata): string {
  if (m.model_label) return m.model_label
  if (!m.model) return 'Unknown'
  return getModelName(m.model)
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

  // Every alias, not just `reference_image_ids` (#380). This block used to
  // read that one field, so an edit through a model's image endpoint -- which
  // records its input as `source_image_id` -- showed no references at all
  // while plainly having had one.
  const referenceImages = await resolveGenerationInputs(
    r.generation_metadata,
    userId,
  )

  return {
    id: r.id,
    thumbnailPath: resolveThumbnailPath(r),
    prompt: m.prompt ?? '',
    model: m.model ?? null,
    modelName: resolveModelName(m),
    source: r.source,
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
    refUsageNote: refUsageNote(m),
    rawMetadataJson: rawMetaJson(r),
  }
}
