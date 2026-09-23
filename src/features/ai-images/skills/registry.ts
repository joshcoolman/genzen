import type { PromptImageSkillDefinition } from './types'

export const IMAGE_SKILLS = [
  {
    id: 'storyboard',
    version: 2,
    command: '/storyboard',
    label: 'Storyboard',
    description: 'Generate a coherent sequence of full-size images.',
    input: { briefRequired: true, references: 'optional' },
    defaults: { shots: 6, shotAspectRatio: '16:9' },
  },
] as const satisfies ReadonlyArray<PromptImageSkillDefinition>

export const PROMPT_IMAGE_SKILLS = IMAGE_SKILLS

export type PromptInvocation =
  | { kind: 'plain'; text: string }
  | {
      kind: 'skill'
      skillId: 'storyboard'
      brief: string
      originalInput: string
      /** Null when the plan chooses the count from the brief. */
      shots: number | null
    }

const COUNTS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  one: 1,
  ten: 10,
  eleven: 11,
  twelve: 12,
}

/** The range a plan can render. `validation.ts` enforces the same numbers. */
const MIN_SHOTS = 2
const MAX_SHOTS = 9

/**
 * The pinned shot count, or null when the brief does not pin one.
 *
 * Null is the normal case: the plan decides how many images the brief wants
 * (#714). `--shots N` and "five shots" still pin it, and a pinned count is
 * still authoritative all the way through validation.
 *
 * **Nothing here refuses a brief.** It used to throw on a count outside 2-9,
 * on a `--shots` with no number, and on a `--shots` with a word after it --
 * three ways for a paragraph of scene description to be rejected on the
 * strength of one token in it. The worst of them was the natural-language
 * match: "maybe ten shots" is a passing thought inside a brief, not an
 * instruction, and it threw away the whole prompt.
 *
 * So an out-of-range number clamps to the range and an unreadable one is
 * ignored, which returns null and lets the plan choose. Both read as the
 * intent they came from: someone who asks for ten wants as many as there are,
 * and someone who typed `--shots` and no number has not said anything yet.
 * The count the request will actually use is on screen before submitting --
 * `promptImageCount` feeds it -- so a clamp is visible rather than silent.
 */
export function storyboardShotCount(brief: string): number | null {
  const explicit = brief.match(/(?:^|\s)--shots(?:=|\s+)(\S+)/i)
  const natural = brief.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]+(?:shots?|panels?)\b/i,
  )
  const token = explicit?.[1] ?? natural?.[1]
  if (token == null) return null
  const count = COUNTS[token.toLowerCase()] ?? Number(token)
  if (!Number.isInteger(count)) return null
  return Math.min(MAX_SHOTS, Math.max(MIN_SHOTS, count))
}

/** Commands occupy the first whitespace-delimited token only. */
export function parsePromptInvocation(input: string): PromptInvocation {
  const text = input.trim()
  if (!text.startsWith('/')) return { kind: 'plain', text }
  const token = text.match(/^\S+/)![0]
  const skill = PROMPT_IMAGE_SKILLS.find(
    (s) => s.command === token.toLowerCase(),
  )
  if (!skill)
    throw new Error(
      `Unknown image command “${token}”. Use /storyboard followed by a scene idea, or remove the leading slash.`,
    )
  const brief = text.slice(token.length).trim()
  const prose = brief.replace(/(?:^|\s)--shots(?:=|\s+)\S+/gi, '').trim()
  if (!prose)
    throw new Error('Add a scene idea after /storyboard before generating.')
  return {
    kind: 'skill',
    skillId: skill.id,
    brief,
    originalInput: input,
    shots: storyboardShotCount(brief),
  }
}

/**
 * Preview the output count while typing.
 *
 * An unpinned storyboard has no count until the plan runs, so the estimate
 * uses the nominal default. The figure it feeds is a cost estimate and the
 * label beside it says the model chooses -- a guess that reads as a guess
 * beats a blank where a number belongs.
 *
 * No `try` any more: `storyboardShotCount` clamps rather than throwing, so a
 * brief asking for ten shows 9 here before submitting. It used to show 0,
 * which said "this will generate nothing" about a prompt that was about to be
 * rejected outright.
 */
export function promptImageCount(prompt: string): number {
  if (!/^\s*\/storyboard(?:\s|$)/i.test(prompt)) return prompt.trim() ? 1 : 0
  return storyboardShotCount(prompt) ?? IMAGE_SKILLS[0].defaults.shots
}
