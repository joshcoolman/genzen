import { createHash } from 'node:crypto'
import { fal } from '@fal-ai/client'
import { buildFalInput } from './fal-params.server'
import type { GenerationOrigin } from '#/lib/types/db'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { describeImage } from '#/lib/server/describe-image.server'
import { endpointFor } from '#/features/ai-images/models'
import { uploadBufferToFal } from '#/lib/server/fal-image-upload.server'
import { getFalWebhookUrl } from '#/lib/server/fal-webhook-url.server'
import { createImageStorage } from '#/lib/image-storage'
import { computeFalCostCents } from '#/lib/server/compute-cost.server'
import {
  createPendingGeneration,
  describeGenerationError,
  markGenerationFailed,
  markGenerationSubmitted,
} from '#/lib/server/create-pending-generation.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export interface GenerateImageInput {
  /** The string sent to the provider. Retry replays this one. */
  prompt: string
  /** What the user typed before the enhancer rewrote it, when it did (#210).
   *  Recorded, not read: the enhanced prompt is re-derivable from this, the
   *  reverse is not, so the typed one is the fact worth keeping. */
  originalPrompt?: string
  /** The textarea contents at submit, when `prompt` is not that -- canvas
   *  prepends auto-generated `[Image 1, ...]` labels. Absent when identical. */
  typedPrompt?: string
  model: string
  /** Which surface authored this request (#207). Required: a generation with no
   *  origin is the absence-of-evidence the column exists to end. */
  origin: GenerationOrigin
  userId?: string
  aspectRatio?: string
  sourceImageBase64?: string
  sourceImageUrl?: string
  /** A library row to use as the primary reference -- the /images highlight.
   *  Resolved to its object server-side, so the caller never names a URL. */
  sourceImageId?: string
  isRefine?: boolean
  referenceImageIds?: Array<string>
  parentImageId?: string
  idempotencyKey?: string
  /** Mark the created row as living on the canvas, so it's reclaimable on load */
  onCanvas?: boolean
}

/** The object behind a library row, scoped to its owner -- the caller passes an
 *  id, so a client cannot name someone else's row or an arbitrary URL. */
async function resolveSourceUrl(
  imageId: string,
  userId: string,
): Promise<string | null> {
  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${imageId} and user_id = ${userId} and deleted_at is null
    `,
  )
  if (!row?.storage_path) return null
  return createImageStorage().getUrl(row.storage_path)
}

function buildRefinePrompt(userPrompt: string): string {
  return `Re-imagine this: ${userPrompt}`
}

export interface GenerateImageResult {
  recordId: string
  request_id: string
  prompt: string
  model: string
}

/**
 * Plain async implementation, and the one every other server caller should use.
 * `generate-image.server.ts` is a thin `'use server'` action over it, kept as the
 * client entry point only. (It used to be a TanStack `createServerFn` whose RPC
 * stub corrupted the response shape for server-to-server callers; that framework
 * is gone, and the split now just separates the action boundary from the logic.)
 */
export async function generateImageInternal(
  data: GenerateImageInput,
): Promise<GenerateImageResult> {
  const { userId } = await resolveAuth()

  const {
    prompt,
    originalPrompt,
    typedPrompt,
    model,
    aspectRatio,
    sourceImageBase64,
    sourceImageUrl,
    sourceImageId,
    isRefine,
  } = data

  if (
    !sourceImageBase64 &&
    !sourceImageUrl &&
    !sourceImageId &&
    !prompt.trim()
  ) {
    throw new Error('Prompt is required')
  }

  // NOTE: the FAL_KEY check deliberately does NOT live here. A missing key is
  // just one failure among many, and failing before the row is reserved is what
  // used to make a click vanish without a card, an Activity entry, or a retry.
  // It is checked inside the reserved-row try block below.

  // Idempotency: if key provided and a non-failed record exists, return it
  if (data.idempotencyKey) {
    const existing = first(
      await sql<
        Array<{ id: string; request_id: string | null; status: string }>
      >`
      select id, request_id, status from user_images
      where idempotency_key = ${data.idempotencyKey} and user_id = ${userId}
    `,
    )
    if (existing && existing.status !== 'failed') {
      return {
        recordId: existing.id,
        request_id: existing.request_id ?? '',
        prompt,
        model,
      }
    }
  }

  // A pasted or dropped source has no library row, so it used to be recorded as
  // `has_source_image: true` -- a boolean where an identity belongs, which made
  // every generation down this path permanently unreproducible while the row
  // looked complete (#210). Decoded here rather than inside runGenerate so the
  // hash is on the row from the moment it is reserved, and the same buffer is
  // what gets uploaded below.
  const sourceBuffer = sourceImageBase64
    ? Buffer.from(
        sourceImageBase64.replace(/^data:image\/\w+;base64,/, ''),
        'base64',
      )
    : null
  const sourceSha256 = sourceBuffer
    ? createHash('sha256').update(sourceBuffer).digest('hex')
    : null

  // Reserve the row BEFORE anything that can fail. Unlike the edit path this
  // one used to write its row with an inline insert *after* FAL accepted the
  // job, so every earlier failure — a bad key, an unreachable source image, a
  // rejected prompt — left nothing at all on the board. The facts that are only
  // knowable after the fallible work (resolved endpoint, a prompt derived from
  // the source image, the cost estimate) are patched on at submit.
  const { recordId } = await createPendingGeneration({
    userId,
    origin: data.origin,
    generationType: data.parentImageId ? 'variation' : undefined,
    falModelId: model,
    prompt: prompt.trim(),
    aspectRatio,
    idempotencyKey: data.idempotencyKey,
    onCanvas: data.onCanvas,
    extraMetadata: {
      // Captured with no reader today, deliberately: unused *code* rots, unused
      // *data* accrues, and a UI can be built over a captured fact at any time
      // while an uncaptured one is gone. See docs/CODE-STANDARDS.md.
      ...(originalPrompt ? { original_prompt: originalPrompt } : {}),
      ...(typedPrompt && typedPrompt !== prompt.trim()
        ? { typed_prompt: typedPrompt }
        : {}),
      ...(sourceSha256
        ? {
            source_image_sha256: sourceSha256,
            source_image_bytes: sourceBuffer!.length,
          }
        : {}),
      ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
      ...(sourceImageId ? { source_image_id: sourceImageId } : {}),
      ...(data.referenceImageIds?.length
        ? { reference_image_ids: data.referenceImageIds }
        : {}),
      ...(data.parentImageId
        ? {
            source_image_id: data.parentImageId, // Immutable: actual generation source
            parent_id: data.parentImageId, // Mutable: group parent (same initially)
          }
        : {}),
    },
  })

  try {
    const request_id = await runGenerate()
    return { recordId, request_id, prompt, model }
  } catch (err) {
    // Log server-side: a swallowed generation error is exactly what made this
    // class of bug invisible in the first place.
    console.error('[generate] generation failed', recordId, err)
    await markGenerationFailed(
      recordId,
      describeGenerationError(err, 'Generation failed'),
    )
    // Rethrown so the client can toast. The card is already marked failed.
    throw err
  }

  async function runGenerate(): Promise<string> {
    if (!process.env.FAL_KEY) {
      throw new Error(
        'FAL_KEY is not set — add it to .env.local and restart the dev server',
      )
    }

    let falModelId = model
    let effectivePrompt = prompt.trim()
    let imageUrl: string | null = null
    // Set when the prompt was written by the describer rather than the user, so
    // an absent `typed_prompt` is never ambiguous between "identical to what was
    // sent" and "nobody typed anything".
    let promptDerivedFromSource = false

    // A source is uploaded to FAL as bytes, never handed over as a URL for FAL
    // to fetch. Passing the public URL through worked in prod and could never
    // work locally, where the object lives on `localhost:9010` -- FAL answered
    // "Could not generate images with the given prompts and images", the same
    // way a reference image would have if it took this path.
    if (sourceImageId || sourceImageUrl) {
      const fetchUrl = sourceImageId
        ? await resolveSourceUrl(sourceImageId, userId)
        : sourceImageUrl!
      if (!fetchUrl) throw new Error('Source image not found')
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error('Could not read the source image')
      imageUrl = await uploadBufferToFal(await res.arrayBuffer())
      falModelId = endpointFor(model, true)
    } else if (sourceBuffer) {
      const buffer = sourceBuffer

      // Detect mime type from magic bytes
      let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
        'image/jpeg'
      const bytes = new Uint8Array(buffer.subarray(0, 4))
      if (bytes[0] === 0x89 && bytes[1] === 0x50) {
        mimeType = 'image/png'
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
        mimeType = 'image/gif'
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49) {
        mimeType = 'image/webp'
      }

      // If no user prompt, ask Haiku for a plain factual description of the image
      if (!effectivePrompt) {
        promptDerivedFromSource = true
        try {
          effectivePrompt = await describeImage(
            buffer.toString('base64'),
            'anchor',
          )
        } catch {
          effectivePrompt = 'image'
        }
      }

      imageUrl = await fal.storage.upload(
        new Blob([buffer], { type: mimeType }),
      )

      // Use image-mode endpoint if specified
      falModelId = endpointFor(model, true)
    }

    // Save the user-facing prompt before any model-specific wrapping
    const metadataPrompt = effectivePrompt

    // Apply refine wrapping for FAL only
    if (imageUrl && isRefine) {
      effectivePrompt = buildRefinePrompt(effectivePrompt)
    }

    // Fetch reference images and upload them to FAL storage
    let referenceUrls: Array<string> = []
    if (data.referenceImageIds?.length) {
      const refImages = await sql<
        Array<{ id: string; storage_path: string | null }>
      >`
        select id, storage_path from user_images
        where id in ${sql(data.referenceImageIds)} and user_id = ${userId}
      `

      if (refImages.length) {
        const storage = createImageStorage()
        const uploads = await Promise.all(
          refImages.map(async (ref) => {
            if (!ref.storage_path) return null
            const signedUrl = await storage.getUrl(ref.storage_path)
            if (!signedUrl) return null
            const res = await fetch(signedUrl)
            const buf = await res.arrayBuffer()
            return uploadBufferToFal(buf)
          }),
        )
        referenceUrls = uploads.filter((u): u is string => u !== null)
      }

      // Reference images require image-input model variant
      if (referenceUrls.length > 0 && !imageUrl) {
        falModelId = endpointFor(model, true)
      }
    }

    // Combine source image + ref images + style refs into imageUrls
    const allImageUrls = [...(imageUrl ? [imageUrl] : []), ...referenceUrls]

    // Build FAL input using schema-driven param resolution
    const falInput = await buildFalInput({
      modelId: falModelId,
      prompt: effectivePrompt,
      aspectRatio,
      ...(allImageUrls.length > 0 ? { imageUrls: allImageUrls } : {}),
      safetyLevel: 'permissive',
    })

    // Submit to FAL async queue (returns immediately)
    const webhookUrl = getFalWebhookUrl()

    const { request_id } = await (fal.queue.submit as any)(falModelId, {
      input: falInput,
      ...(webhookUrl ? { webhookUrl } : {}),
    })

    const estimatedCostCents = await computeFalCostCents(falModelId, {
      aspectRatio,
    }).catch(() => null)

    await markGenerationSubmitted(recordId, request_id, {
      fal_model_id: falModelId,
      prompt: metadataPrompt,
      ...(promptDerivedFromSource ? { prompt_derived_from_source: true } : {}),
      ...(estimatedCostCents != null
        ? { estimated_cost_cents: estimatedCostCents }
        : {}),
    })

    return request_id
  }
}
