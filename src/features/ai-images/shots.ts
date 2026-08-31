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
 * The short path: the angle description, plus whatever the user typed.
 *
 * **This is the whole prompt now, and it used to be a third of it.** A constant
 * block led it -- "inventory everything visible in the reference image... all
 * of it must remain 100% unchanged" -- carried over from the procedure these
 * sixteen were written for. Read as an instruction to FAL it is inert: nobody
 * is inventorying, and an image model cannot act on "describe only the final
 * camera position". Most of what was being sent was addressed to a reader that
 * was not there. Its prose was not wrong, only misdirected, and it now steers
 * the vision model on the `Enhance` path (`enhance.md`), where something really
 * does look at the picture and write.
 *
 * What is left is what the run actually proved: the angle, and the picture it
 * is applied to. A typed instruction is appended plainly, with no ranking
 * clause, because there is no longer a freeze for it to argue with.
 *
 * Lazy `.md` loads (#322): the dialog imports this module for its model list,
 * and static imports would ship all sixteen descriptions to the browser.
 */
export async function buildShotPrompt(
  shotId: string,
  instructions = '',
): Promise<string> {
  const shot = findShot(shotId)
  if (!shot) throw new Error(`Unknown shot "${shotId}"`)
  const nudge = instructions.trim()
  const { default: description } = await shot.system()
  return [description.trim(), nudge].filter(Boolean).join('\n\n')
}
