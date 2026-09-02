import outpaintInstruction from '#/lib/prompts/outpaint.md'
import { IMAGE_MODELS, pickerId } from '#/features/ai-images/models'

/**
 * Outpainting: reframing a picture you already have to a shape you need.
 *
 * The lab page (#430) asked whether a model can do it at all, across several
 * models at once. It can, and Grok Imagine 2.0 is the one that does it well
 * enough to stop asking -- so the answer moved into the `...` menu on a card,
 * where the picture already is, the model became a constant instead of a
 * control, and the page was deleted (#528).
 *
 * **The one knob, in one place.** `OUTPAINT_MODEL_SLUG` is expected to change
 * as the lineup does; nothing else about the flow depends on which model it
 * names, so changing it is a one-line edit here and no UI at all. If a picker
 * is ever wanted back, this constant is where a selection would be injected.
 *
 * Three things the lab page established, kept here because the page that
 * proved them is gone:
 *
 * **Asking plainly is enough, and compositing must not be built
 * speculatively.** The picture goes to the model with the instruction and the
 * target ratio and nothing else -- no canvas, no empty bars drawn for the
 * model to fill, no crop. That was the open question, and Josh settled it by
 * use on 2026-08-19: portrait sources to 5:4 and to 1:1 both came back right.
 * #317 proved the browser *could* composite first; nothing has asked it to.
 *
 * **The instruction pads and never crops.** Any ratio change has two valid
 * answers and `outpaint.md` commits to one, in the language of growth
 * throughout, with no clause for a target smaller in some dimension. That gap
 * was looked for and did not show up in results, so it stays as it is -- worth
 * knowing before editing the prose.
 *
 * **Not every image model can do this.** Z-Image Turbo notably cannot: its
 * image endpoint is denoise-from-image with a `strength` dial rather than
 * instruct editing, so telling it to change something returns the same picture
 * at any strength. A model swap here needs evidence, not a price comparison.
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
