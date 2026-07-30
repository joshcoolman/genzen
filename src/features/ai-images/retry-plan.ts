/** What a retry can replay, decided from the stored metadata alone.
 *
 *  Pure so it can be tested without FAL or a database: everything here is a
 *  reading of `generation_metadata`, and the reasons a retry is impossible are
 *  facts about that row rather than about the network. */

export interface RetryMetadata {
  prompt?: string
  model?: string
  fal_model_id?: string
  aspect_ratio?: string
  source_image_id?: string
  source_image_url?: string
  source_image_sha256?: string
  reference_image_ids?: Array<string>
}

export type RetrySource =
  /** A library row -- resolve its storage path and upload the bytes. */
  | { kind: 'library'; imageId: string }
  /** A remote URL -- fetch it and upload the bytes. Never passed to FAL as-is. */
  | { kind: 'url'; url: string }
  | { kind: 'none' }

export interface RetryPlan {
  prompt: string
  /** The base model id. The endpoint is derived, never read from the row -- see
   *  `unreproducible` note below on why the stored one cannot be trusted. */
  model: string
  aspectRatio?: string
  source: RetrySource
  referenceImageIds: Array<string>
}

export class RetryNotReproducible extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryNotReproducible'
  }
}

/** Read a plan out of a failed row, or explain why there isn't one.
 *
 *  Throws `RetryNotReproducible` rather than returning a partial plan. A retry
 *  that quietly drops the source is worse than one that refuses: it looks like
 *  it worked and silently generates something else (#214). */
export function planRetry(meta: RetryMetadata): RetryPlan {
  if (!meta.prompt || !meta.model) {
    throw new RetryNotReproducible(
      'This generation is missing its prompt or model, so it cannot be retried.',
    )
  }

  let source: RetrySource = { kind: 'none' }
  if (meta.source_image_id) {
    source = { kind: 'library', imageId: meta.source_image_id }
  } else if (meta.source_image_url) {
    source = { kind: 'url', url: meta.source_image_url }
  } else if (meta.source_image_sha256) {
    // #210 gave a pasted source a sha256, which identifies the image but cannot
    // restore it -- nothing in the app holds those bytes once the request is
    // over. Refusing is the honest answer; retrying without the source would
    // generate a different image under the same prompt.
    throw new RetryNotReproducible(
      'The source image for this generation was pasted rather than saved to your library, so it cannot be sent again. Re-attach the image and generate.',
    )
  }

  return {
    prompt: meta.prompt,
    model: meta.model,
    ...(meta.aspect_ratio ? { aspectRatio: meta.aspect_ratio } : {}),
    source,
    referenceImageIds: meta.reference_image_ids ?? [],
  }
}

/** Whether this plan sends any image to FAL, which decides the endpoint.
 *
 *  The stored `fal_model_id` cannot answer this. It is written at reserve time
 *  as the *base* model and only patched to the resolved endpoint at submit, so a
 *  generation that failed **before** submit -- a missing key, an unreadable
 *  source -- kept the text-to-image endpoint. Those are precisely the rows a
 *  user retries, so trusting the stored value sends images to an endpoint that
 *  does not take them. */
export function planHasImages(plan: RetryPlan): boolean {
  return plan.source.kind !== 'none' || plan.referenceImageIds.length > 0
}
