import { aspectRatiosFor, videoModelBySlug } from '#/features/video/models'

/**
 * Multi-shot prompt writers: a bare idea in, a shot-by-shot video prompt out.
 *
 * **Duration and aspect ratio are controls, and they come off the video model
 * this writer is for.** They were read out of the prose until #522 -- "maybe
 * 20 seconds" in the idea box -- on the reasoning that a control would mean
 * typing the number twice. What that missed is that the clip is generated with
 * a duration and an aspect ratio *as parameters* whatever the prose said, so
 * the two could silently disagree: a script timed to 00:20.000 submitted at
 * 6s is a script the model has to throw four fifths of away. Naming the video
 * model here is what closes it -- the controls offer exactly `durations` and
 * the text-to-video `aspectRatios` off that lineup record, so a writer cannot
 * offer a length its own model will refuse.
 *
 * A writer for a different video model's dialect is a new file plus an entry
 * here -- which is the point. These are meant to be tried, kept or thrown
 * away, and a control would make each one a code change instead of a text
 * edit.
 *
 * Same registry shape as `../describe`: wiring only, and `system` is loaded
 * lazily because the lab's client modules read this array for its labels.
 */
export const MULTI_SHOT_PROMPTS = [
  {
    id: 'minimax-h3',
    label: 'Multi-shot · MiniMax H3',
    file: 'src/lib/prompts/multi-shot/minimax-h3.md',
    /**
     * Whose dialect this is, and where its controls get their options.
     * **Serves H3 Max too** -- a post-trained variant of the same model, with
     * the same durations and the same text-to-video ratios, so it reads the
     * same prompt language. If the two ever diverge, that is a second file
     * here rather than a branch in this one.
     */
    videoModelSlug: 'minimax-h3',
    system: () => import('./minimax-h3.md'),
  },
] as const

export type MultiShotId = (typeof MULTI_SHOT_PROMPTS)[number]['id']

export function multiShotPrompt(id: string) {
  return MULTI_SHOT_PROMPTS.find((p) => p.id === id)
}

/**
 * The lengths and shapes this writer may be asked for.
 *
 * Straight off the video lineup, never a list of its own: a writer that
 * offered 20s for a model whose ceiling is 15 would produce a script that
 * cannot be generated, and the failure would land at FAL long after the words
 * looked right.
 */
export function multiShotOptions(id: string): {
  durations: Array<number>
  aspectRatios: Array<string>
  defaultDuration: number
} | null {
  const writer = multiShotPrompt(id)
  if (!writer) return null
  const model = videoModelBySlug(writer.videoModelSlug)
  if (!model) return null
  return {
    durations: model.durations,
    // `false`: these writers produce text-to-video prompts, so the ratios are
    // that endpoint's -- `auto` has no image to match and would be rejected.
    aspectRatios: aspectRatiosFor(model, false),
    defaultDuration: model.defaultDuration,
  }
}
