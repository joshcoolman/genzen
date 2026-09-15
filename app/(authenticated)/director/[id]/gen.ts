import type { VideoModel } from '#/features/video/models'
import { videoModelBySlug } from '#/features/video/models'

/**
 * What a clip generated inside a run is made with.
 *
 * **One model, and no picker** (#660). Several of the lineup take a first frame
 * and would work here -- but their durations do not intersect (min 3, 4 and 5),
 * so the pills would have to follow the model, and the price spread runs to 47c
 * a second. A control that changes the other controls is the opposite of the
 * one-click feel this page is for.
 *
 * **H3 Max Turbo, on the strength of a side-by-side.** This began on plain H3,
 * on the reasoning that it was the cheapest thing Director had proved out --
 * and Director turned out not to be running it. Its default is
 * `minimax/h3-max-turbo/image-to-video`, hardcoded in `director/clips.ts` and
 * absent from the lineup entirely until #660, which is why the clips there felt
 * faster than the ones here. It is a post-trained variant on fal's own
 * inference stack rather than MiniMax's hosted API: quicker, better at
 * following a prompt, and by fal's stated rate a great deal cheaper. See its
 * entry in `models.ts` for why that last number is not yet to be trusted.
 *
 * It has no `generate_audio` param, which is not the same as being silent --
 * `supportsAudio` says whether the parameter exists, and this family's clips
 * have sound whether or not anyone asks.
 */
export const GEN_MODEL_SLUG = 'h3-max-turbo'

export function genModel(): VideoModel {
  const model = videoModelBySlug(GEN_MODEL_SLUG)
  if (!model) throw new Error(`Unknown video model: ${GEN_MODEL_SLUG}`)
  return model
}

/**
 * The ratio to submit with.
 *
 * With a first frame this is ignored: `minimax/h3/image-to-video` declares
 * `aspectRatios: []`, meaning the endpoint has no `aspect_ratio` param at all
 * and its output follows the frame it was given -- which is exactly why a
 * continuation always matches the run without anyone choosing. It is still
 * sent, because it lands in the row's metadata and a clip that says nothing
 * about its shape is harder to read later than one that says the truth.
 *
 * Without a frame it is a real choice, and the only one the dialog ever shows.
 */
export const GEN_FALLBACK_RATIO = '16:9'

export function genRatios(): Array<string> {
  return genModel().endpoints.textToVideo.aspectRatios
}

/**
 * The named ratio closest to a run's actual shape.
 *
 * `aspectRatio()` answers with a number, because a clip's shape is its pixels
 * and the lineup returns several pixel sizes per named ratio (1280x720 and
 * 1280x704 are both "16:9"). A ratio *control* can only offer names, so the
 * number has to be rounded to one -- nearest rather than exact, for the same
 * reason `sameShape` has a tolerance.
 *
 * Used for two different things, and it is worth being clear which: with a
 * frame this only fills in the metadata on the row, since the endpoint takes no
 * ratio; with no frame it seeds the pills, so a hard cut still starts on the
 * shape the rest of the run is.
 */
export function nearestGenRatio(value: number | null): string {
  return nearestRatio(genRatios(), value)
}

/** The named ratio in `ratios` closest to a measured shape. */
export function nearestRatio(
  ratios: Array<string>,
  value: number | null,
): string {
  if (!value || !Number.isFinite(value)) return GEN_FALLBACK_RATIO
  const named = ratios.map((id) => {
    const [w, h] = id.split(':').map(Number)
    return { id, value: w / h }
  })
  if (named.length === 0) return GEN_FALLBACK_RATIO
  return named.reduce((best, option) =>
    Math.abs(option.value - value) < Math.abs(best.value - value)
      ? option
      : best,
  ).id
}

/* ------------------------------------------------------------ references
   Naming something that has left the shot (#665). */

/**
 * What a clip with reference images is made with.
 *
 * **Kling O3 Pro, because it is the only model in the lineup that takes both.**
 * `fal-ai/kling-video/o3/pro/reference-to-video` accepts `start_image_url` and
 * `image_urls` on the same request, so the previous clip's ending still pins
 * frame one while the references carry who and what. Seedance 2.5's reference
 * endpoint has no first-frame parameter at all and cannot be the one, and H3
 * Max Turbo has no reference endpoint.
 *
 * **So a reference switches the model, and there is still no picker.** The
 * inputs select the model, exactly as they do on Video: adding a reference
 * moves the request here, dropping every reference moves it back. What the
 * dialog owes in return is the price, which is the whole of the trade --
 * 14c/s against 0.625c/s, roughly $1.12 for an eight-second clip against
 * $0.05.
 */
export const REF_MODEL_SLUG = 'kling-o3-pro'

export function refModel(): VideoModel {
  const model = videoModelBySlug(REF_MODEL_SLUG)
  if (!model) throw new Error(`Unknown video model: ${REF_MODEL_SLUG}`)
  return model
}

/** The model a request with this many references goes to. */
export function genModelFor(referenceCount: number): VideoModel {
  return referenceCount > 0 ? refModel() : genModel()
}

/**
 * How many references one clip may carry.
 *
 * The app's limit rather than fal's: `models.ts` records four because fal
 * documents four *with video elements*, and this composer only ever sends
 * stills. Read it off the record so the two cannot disagree.
 */
export const MAX_REFS =
  refModel().endpoints.withReferences?.references?.max ?? 4

/**
 * The ratio to submit, against whichever model the inputs chose.
 *
 * H3 Max Turbo's text endpoint offers 4:3, 3:4 and 21:9; Kling's reference
 * endpoint offers 16:9, 9:16 and 1:1 and **validates what it is sent** -- so a
 * shape chosen with no references, or measured off a run that is 4:3, has to
 * be brought back to a ratio the chosen endpoint names. Nearest by value, for
 * the reason `nearestGenRatio` gives: a ratio control can only offer names.
 */
export function clampRatio(ratios: Array<string>, id: string): string {
  if (ratios.length === 0 || ratios.includes(id)) return id
  const [w, h] = id.split(':').map(Number)
  return nearestRatio(ratios, w && h ? w / h : null)
}

/** The ratio pills a request with this many references should show. */
export function genRatiosFor(referenceCount: number): Array<string> {
  const model = genModelFor(referenceCount)
  const endpoint =
    referenceCount > 0
      ? model.endpoints.withReferences
      : model.endpoints.textToVideo
  return endpoint?.aspectRatios ?? []
}
