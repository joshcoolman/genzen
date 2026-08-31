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
 * The constant block, then the shot, then whatever the user typed.
 *
 * Order is the precedence, and it is the whole design. The block inventories
 * the reference and freezes it; the shot says where the camera goes; the
 * override block re-ranks the two against an instruction and hands the
 * instruction over last.
 *
 * **A nudge has to outrank the freeze, or it does nothing.** The constant block
 * locks the environment, the lighting and the colour grade -- so "inside a
 * clean cement warehouse" appended to it is two contradictory orders, and the
 * model picks one. `overrides.md` is what makes that a ranking instead of a
 * collision: the instruction beats the freeze, silence leaves the freeze
 * standing, and the camera position beats the instruction. It is loaded only
 * when there is something to rank, so the no-nudge path is byte-identical to
 * the sixteen prompts that were proven by hand (#553).
 *
 * Every file is `.md` and every load is lazy (#322): the dialog imports this
 * module for its model list, and static imports would ship all sixteen shot
 * descriptions to the browser.
 */
export async function buildShotPrompt(
  shotId: string,
  instructions = '',
): Promise<string> {
  const shot = findShot(shotId)
  if (!shot) throw new Error(`Unknown shot "${shotId}"`)
  const nudge = instructions.trim()
  const [{ default: constant }, { default: description }] = await Promise.all([
    import('#/lib/prompts/shots/constant.md'),
    shot.system(),
  ])
  const parts = [constant.trim(), description.trim()]
  if (nudge) {
    const { default: overrides } =
      await import('#/lib/prompts/shots/overrides.md')
    parts.push(overrides.trim(), nudge)
  }
  return parts.join('\n\n')
}
