/**
 * Multi-shot prompt writers: a bare idea in, a shot-by-shot video prompt out.
 *
 * **Model and duration are baked into the `.md`, not lifted into controls.**
 * A 15-second variant, or one written for a different video model's dialect,
 * is a copy of the file with two numbers changed -- which is the point. These
 * are meant to be tried, kept or thrown away, and a control would make each
 * one a code change instead of a text edit.
 *
 * Same registry shape as `../describe`: wiring only, and `system` is loaded
 * lazily because the lab's client modules read this array for its labels.
 */
export const MULTI_SHOT_PROMPTS = [
  {
    id: 'minimax-h3-10s',
    label: 'Multi-shot · MiniMax H3, 10s',
    file: 'src/lib/prompts/multi-shot/minimax-h3-10s.md',
    system: () => import('./minimax-h3-10s.md'),
  },
] as const

export type MultiShotId = (typeof MULTI_SHOT_PROMPTS)[number]['id']

export function multiShotPrompt(id: string) {
  return MULTI_SHOT_PROMPTS.find((p) => p.id === id)
}
