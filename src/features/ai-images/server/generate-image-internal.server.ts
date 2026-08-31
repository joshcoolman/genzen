import { createHash } from 'node:crypto'
import { fal } from '@fal-ai/client'
import { buildFalInput } from './fal-params.server'
import type { GenerationOrigin } from '#/lib/types/db'
import { withNetworkRetry } from '#/lib/server/fal-retry.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { DEFAULT_DESCRIBE_MODE } from '#/lib/prompts/describe'
import { describeImage } from '#/lib/server/describe-image.server'
import { endpointFor } from '#/features/ai-images/models'
import { assertFalKey } from '#/lib/server/fal-key.server'
import { uploadBufferToFal } from '#/lib/server/fal-image-upload.server'
import {
  uploadLibraryImageToFal,
  uploadLibraryImagesToFal,
} from '#/lib/server/fal-image-inputs.server'
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
  /** The canvas this generation was submitted from, if any: its row joins that
   *  board at reserve time, so it is reclaimable on load (#446). */
  canvasId?: string
  /** File the result into a group (#319) -- set when the generator submitted
   *  from inside one. Verified against the caller's user id before it is
   *  written; see `createPendingGeneration`. */
  groupId?: string | null
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
    // What the user typed, which is what every card, lightbox and variation
    // seed shows (#367). It used to be the sent string -- system instructions
    // and canvas image labels included -- so a caption grew a preamble it never
    // had when the optimistic card became real. The sent string is still
    // recorded, under `sent_prompt`, which is what Retry replays.
    prompt: (typedPrompt ?? prompt).trim(),
    aspectRatio,
    idempotencyKey: data.idempotencyKey,
    canvasId: data.canvasId,
    groupId: data.groupId,
    extraMetadata: {
      // Captured with no reader today, deliberately: unused *code* rots, unused
      // *data* accrues, and a UI can be built over a captured fact at any time
      // while an uncaptured one is gone. See docs/DELTAS.md.
      ...(typedPrompt && typedPrompt !== prompt.trim()
        ? { sent_prompt: prompt.trim() }
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
    assertFalKey()

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
      // A library source is read from the bucket; only a genuinely external
      // URL is fetched. Since #226 our own images have no fetchable URL at all.
      //
      // The library path goes through the shared upload, so a submit against
      // three models moves these bytes once rather than three times (#313).
      if (sourceImageId) {
        // Null means the row or its file is gone -- a real missing source. A
        // read that failed throws its own reason now (#556): both used to land
        // on the sentence below, so a dead connection read as a deleted
        // picture and sent you looking in Trash.
        const uploaded = await uploadLibraryImageToFal(sourceImageId, userId)
        if (!uploaded) throw new Error('Source image not found')
        imageUrl = uploaded
      } else {
        const buffer = await fetch(sourceImageUrl!).then((res) => {
          if (!res.ok) throw new Error('Could not read the source image')
          return res.arrayBuffer()
        })
        imageUrl = await uploadBufferToFal(buffer)
      }
      falModelId = endpointFor(model, true)
    } else if (sourceBuffer) {
      const buffer = sourceBuffer

      // If no user prompt, ask Haiku for a plain factual description of the image
      if (!effectivePrompt) {
        promptDerivedFromSource = true
        // **No fallback** (#365). This used to catch and set the prompt to the
        // literal string "image", then generate anyway -- full price, on a
        // one-word prompt, for a request built out of a picture. With no
        // ANTHROPIC_API_KEY that happened on every image-only generation,
        // quietly, forever. Every other Anthropic call in the app already fails
        // loudly; this was the one that swallowed.
        effectivePrompt = await describeImage(
          buffer.toString('base64'),
          DEFAULT_DESCRIBE_MODE,
        )
      }

      // Through the shared helper, so this path gets the transient-transport
      // retry every other upload has (#556).
      imageUrl = await uploadBufferToFal(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
      )

      // Use image-mode endpoint if specified
      falModelId = endpointFor(model, true)
    }

    // The prompt a person would recognise as theirs: what they typed, or -- when
    // they typed nothing and generated from a picture alone -- the description
    // the describer wrote for them, which is the only prompt that generation
    // has. That second case is the one place a caption legitimately arrives
    // late, because there was nothing to show at click time (#367).
    const metadataPrompt = typedPrompt ?? effectivePrompt

    // Apply refine wrapping for FAL only
    if (imageUrl && isRefine) {
      effectivePrompt = buildRefinePrompt(effectivePrompt)
    }

    // Reference images go to FAL as bytes, same as the source. Shared with the
    // retry path so the two cannot drift (#214).
    const referenceUrls = await uploadLibraryImagesToFal(
      data.referenceImageIds ?? [],
      userId,
    )
    // Reference images require the image-input model variant
    if (referenceUrls.length > 0 && !imageUrl) {
      falModelId = endpointFor(model, true)
    }

    // Combine source image + ref images + style refs into imageUrls
    const allImageUrls = [...(imageUrl ? [imageUrl] : []), ...referenceUrls]

    // Build FAL input using schema-driven param resolution
    const {
      input: falInput,
      imagesRequested,
      imagesUsed,
    } = await buildFalInput({
      modelId: falModelId,
      prompt: effectivePrompt,
      aspectRatio,
      ...(allImageUrls.length > 0 ? { imageUrls: allImageUrls } : {}),
      safetyLevel: 'permissive',
    })

    // Submit to FAL async queue (returns immediately)

    const { request_id } = await withNetworkRetry<{ request_id: string }>(
      'queue.submit',
      () => (fal.queue.submit as any)(falModelId, { input: falInput }),
    )

    const estimatedCostCents = await computeFalCostCents(falModelId, {
      aspectRatio,
    }).catch(() => null)

    await markGenerationSubmitted(recordId, request_id, {
      fal_model_id: falModelId,
      prompt: metadataPrompt,
      // The string FAL actually received, after the describer, the system
      // instructions and any refine wrapping. Recorded only when it differs
      // from what the user would call their prompt; Retry replays this one, and
      // falls back to `prompt` for rows written before the two split (#367).
      ...(effectivePrompt !== metadataPrompt
        ? { sent_prompt: effectivePrompt }
        : {}),
      ...(promptDerivedFromSource ? { prompt_derived_from_source: true } : {}),
      // Only when they disagree (#341). Written on every row it applies to, so
      // a card can say "used 1 of 5 images" without re-deriving a capacity that
      // may have changed since -- the row is what happened, not what would
      // happen now.
      ...(imagesRequested > imagesUsed
        ? { images_requested: imagesRequested, images_used: imagesUsed }
        : {}),
      ...(estimatedCostCents != null
        ? { estimated_cost_cents: estimatedCostCents }
        : {}),
    })

    return request_id
  }
}
