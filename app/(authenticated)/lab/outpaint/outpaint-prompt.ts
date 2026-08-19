import outpaintInstruction from '#/lib/prompts/outpaint.md'

/**
 * The instruction, plus the two things it cannot know: the shape asked for and
 * whatever nudge was typed.
 *
 * Assembly lives here and the prose lives in the `.md` (#322) -- the page
 * exists to tune the prose, and tuning it must be a text edit rather than a
 * code change.
 */
export function buildOutpaintPrompt(
  aspectRatio: string,
  guidance: string,
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
