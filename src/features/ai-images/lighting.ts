import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'
import { findLightingEffect, lightingWrapper } from '#/lib/prompts/lighting'

/**
 * Lighting: one picture in, the same picture under a named light (#563).
 *
 * **Shots' surface, outpaint's mechanism.** It is opened from the reference
 * strip and multi-selects like Shots, so every staged picture crossed with
 * every effect is its own generation. But there is no vision pass in front of
 * it and no prompt written per run: the effect is a fixed paragraph and the
 * wrapper is prepended in code, exactly as `buildOutpaintPrompt` does. Shots
 * needs a scene written once because sixteen frames of one subject have to
 * agree with each other; two relights of one picture have nothing to agree
 * about, so the writer would be spend with no drift to remove.
 *
 * **The model picker is the experiment, not a preference** -- the same reason
 * Shots has one and outpaint does not. Nano Banana 2 renders both effects;
 * Grok renders the split field as a backdrop swap with the skin left neutral,
 * which is a real result about instruct-editing reach rather than a bad prompt,
 * and the only way to keep finding that out is to be able to send the same
 * effect somewhere else.
 */

/**
 * Where the picker starts: the one model both effects were verified on
 * (2026-09-01, `fal-ai/nano-banana-2/edit`).
 */
export const DEFAULT_LIGHTING_MODEL_SLUG = 'nano-banana-2'

/**
 * Z-Image Turbo is excluded for the reason it is excluded everywhere an
 * instruction has to reach a picture: its image endpoint is denoise-from-image
 * with a `strength` dial rather than instruct editing, so a relight comes back
 * as the reference at any strength. Its text-to-image endpoint *does* render
 * the hard rake -- from nothing, which is a different feature.
 */
const EXCLUDED_SLUGS = new Set(['z-image-turbo'])

export function lightingModelOptions(): Array<{
  value: string
  label: string
}> {
  return IMAGE_MODELS.filter(
    (m) => m.withImages !== null && !EXCLUDED_SLUGS.has(m.slug),
  ).map((m) => ({ value: pickerId(m), label: m.name }))
}

export function defaultLightingModelId(): string {
  const model = IMAGE_MODELS.find((m) => m.slug === DEFAULT_LIGHTING_MODEL_SLUG)
  if (!model) {
    throw new Error(
      `Default lighting model "${DEFAULT_LIGHTING_MODEL_SLUG}" is not in the lineup`,
    )
  }
  return pickerId(model)
}

/**
 * The wrapper, a blank line, the effect -- which is the exact string the test
 * ran. Assembly here and prose in the `.md` (#322): changing what a light looks
 * like is a text edit, and nothing about the join is per-effect.
 */
export async function buildLightingPrompt(effectId: string): Promise<string> {
  const effect = findLightingEffect(effectId)
  if (!effect) throw new Error(`Unknown lighting effect "${effectId}"`)

  const [{ default: wrapper }, { default: description }] = await Promise.all([
    lightingWrapper(),
    effect.system(),
  ])
  return `${wrapper.trim()}\n\n${description.trim()}`
}
