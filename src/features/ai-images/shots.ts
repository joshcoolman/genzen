import { findShot } from '#/lib/prompts/shots'
import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

/**
 * Shots: one picture in, the same subject from somewhere else the camera could
 * have been (#553).
 *
 * It is outpaint's trade, widened. Outpaint is a pre-packaged instruction plus
 * one variable and no user prose; this is sixteen of them, multi-selected, off
 * the same card menu. The one thing it adds is a model picker, because outpaint
 * had its question settled -- Grok can do it -- and this one does not: which
 * model holds a subject's identity across a camera move is the thing the
 * feature exists to find out.
 *
 * **It takes no prompt, on purpose.** A finished version probably does, and
 * working out how a typed prompt composes with a shot description is exactly
 * the distraction that stops this getting built. The picture and the shot are
 * the whole request.
 *
 * **No describe pass in front of it, on the same reasoning.** The obvious worry
 * is that a model must know what the picture *is* before it can put a worm's-eye
 * camera under it. The sixteen were run without one and came back on-angle, so
 * the burden is on the output to ask for a describe step, not on the guess.
 */
/**
 * Where the picker starts. Nano Banana 2 by choice, not by benchmark -- the
 * proving run for these prompts was FLUX Kontext Pro, which has since left the
 * lineup, so there is no incumbent to defer to and the default is a starting
 * point to argue with rather than a finding.
 */
export const DEFAULT_SHOT_MODEL_SLUG = 'nano-banana-2'

/**
 * Models offered in the dialog: every one with an image endpoint, minus the one
 * that cannot take an instruction.
 *
 * **Z-Image Turbo is excluded, and it is not a quality call.** Its image
 * endpoint is denoise-from-image with a `strength` dial rather than instruct
 * editing, so telling it to move the camera returns the same picture at any
 * strength -- the same finding that keeps it out of outpaint
 * (`src/features/ai-images/outpaint.ts`). Offering it would spend money to
 * produce the reference again.
 */
const EXCLUDED_SLUGS = new Set(['z-image-turbo'])

export function shotModelOptions(): Array<{ value: string; label: string }> {
  return IMAGE_MODELS.filter(
    (m) => m.withImages !== null && !EXCLUDED_SLUGS.has(m.slug),
  ).map((m) => ({ value: pickerId(m), label: m.name }))
}

export function defaultShotModelId(): string {
  const model = IMAGE_MODELS.find((m) => m.slug === DEFAULT_SHOT_MODEL_SLUG)
  if (!model) {
    throw new Error(
      `Default shot model "${DEFAULT_SHOT_MODEL_SLUG}" is not in the lineup`,
    )
  }
  return pickerId(model)
}

/**
 * The constant block, then the shot. Both are `.md` and both are loaded lazily
 * (#322): the dialog imports this module for its model list, and a static
 * import would ship all sixteen shot descriptions to the browser.
 *
 * Order matters -- the block inventories the reference and freezes it, and the
 * shot then says where the camera goes. Reversed, the freeze reads as a
 * correction to the instruction above it.
 */
export async function buildShotPrompt(shotId: string): Promise<string> {
  const shot = findShot(shotId)
  if (!shot) throw new Error(`Unknown shot "${shotId}"`)
  const [{ default: constant }, { default: description }] = await Promise.all([
    import('#/lib/prompts/shots/constant.md'),
    shot.system(),
  ])
  return [constant.trim(), description.trim()].join('\n\n')
}
