import type { VideoModel } from '#/features/video/models'
import { videoModelBySlug } from '#/features/video/models'

/**
 * What a clip generated inside a run is made with.
 *
 * **One model, and no picker** (#660). Three of the lineup take a first frame
 * and would work here -- but their durations do not intersect (min 3, 4 and 5),
 * so the pills would have to follow the model, and the price spread is 6c to
 * 47c a second. A control that changes the other controls is the opposite of
 * the one-click feel this page is for.
 *
 * H3 is the pick because it is the cheapest in the lineup, it is the family
 * Director proved out, and it carries native audio. It has no `generate_audio`
 * param, which is not the same as being silent -- `supportsAudio` says whether
 * the parameter exists, and H3's clips have sound whether or not anyone asks.
 */
export const GEN_MODEL_SLUG = 'minimax-h3'

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
  if (!value || !Number.isFinite(value)) return GEN_FALLBACK_RATIO
  const named = genRatios().map((id) => {
    const [w, h] = id.split(':').map(Number)
    return { id, value: w / h }
  })
  return named.reduce((best, option) =>
    Math.abs(option.value - value) < Math.abs(best.value - value)
      ? option
      : best,
  ).id
}
