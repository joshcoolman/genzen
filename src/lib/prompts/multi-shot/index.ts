/**
 * Multi-shot prompt writers: a bare idea in, a shot-by-shot video prompt out.
 *
 * **Duration is read out of the request, not chosen in the UI.** "an exploded
 * view of a car engine, techno vibe, maybe 20 seconds" is one thing a person
 * says, and splitting the number out into a control would mean typing it in
 * two places. The instruction takes what it is given and falls back to 10s.
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
    system: () => import('./minimax-h3.md'),
  },
] as const

export type MultiShotId = (typeof MULTI_SHOT_PROMPTS)[number]['id']

export function multiShotPrompt(id: string) {
  return MULTI_SHOT_PROMPTS.find((p) => p.id === id)
}
