import outpaintInstruction from '#/lib/prompts/outpaint.md'
import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

/**
 * Outpainting: reframing a picture you already have to a shape you need.
 *
 * The lab page (#430) asked whether a model can do it at all, across several
 * models at once. It can, and Grok Imagine 2.0 is the one that does it well
 * enough to stop asking -- so the answer moved into the `...` menu on a card,
 * where the picture already is, and the model became a constant instead of a
 * control.
 *
 * **The one knob, in one place.** `OUTPAINT_MODEL_SLUG` is expected to change
 * as the lineup does; nothing else about the flow depends on which model it
 * names, so changing it is a one-line edit here and no UI at all. If a picker
 * is ever wanted back, this constant is where a selection would be injected.
 */
export const OUTPAINT_MODEL_SLUG = 'grok-imagine-image-2'

/**
 * The model id a submit carries -- the picker id, not the endpoint. Which of
 * the model's two endpoints gets hit is `endpointFor`'s call, and outpainting
 * always sends a source image, so it is always the edit one.
 *
 * Throws rather than falling back: a silently substituted model would spend
 * real money answering a different question.
 */
export function outpaintModelId(): string {
  const model = IMAGE_MODELS.find((m) => m.slug === OUTPAINT_MODEL_SLUG)
  if (!model) {
    throw new Error(
      `Outpaint model "${OUTPAINT_MODEL_SLUG}" is not in the lineup`,
    )
  }
  return pickerId(model)
}

/**
 * The instruction, plus the two things it cannot know: the shape asked for and
 * whatever nudge was typed.
 *
 * Assembly lives here and the prose lives in the `.md` (#322) -- changing what
 * the model is told must be a text edit rather than a code change.
 */
export function buildOutpaintPrompt(
  aspectRatio: string,
  guidance = '',
): string {
  const nudge = guidance.trim()
  return [
    outpaintInstruction.trim(),
    `Target frame: ${aspectRatio}.`,
    nudge && `Also: ${nudge}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
