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
 * How a shot's prompt gets written. Two, because one of them is on trial.
 *
 * `scene-shot` establishes the scene once per picture and directs each angle on
 * top of it, concatenated in code. `per-shot` writes the whole prompt fresh for
 * every angle, which is what shipped first and what the set drifted under.
 *
 * **This control is meant to die.** It exists to answer one question with
 * pictures; when it is answered the winner becomes the only path and the
 * control goes, the way Outpaint's model picker did once its lab page settled
 * which model. There was a third mode -- the angle description sent to FAL with
 * no writer at all -- and it is already gone: judged on results as random and
 * poor, which is what a settled question looks like.
 */
export const SHOT_MODES = [
  { value: 'scene-shot', label: 'Scene + shot' },
  { value: 'per-shot', label: 'Per shot' },
] as const

export type ShotMode = (typeof SHOT_MODES)[number]['value']

export const DEFAULT_SHOT_MODE: ShotMode = 'scene-shot'
