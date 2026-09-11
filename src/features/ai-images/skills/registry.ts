import type { ImageSkillDefinition } from './types'

export const IMAGE_SKILLS = [
  {
    id: 'storyboard',
    version: 1,
    command: '/storyboard',
    label: 'Storyboard',
    description: 'Plan a scene as one coherent shot sheet.',
    input: { briefRequired: true, references: 'optional' },
    defaults: { shots: 6, shotAspectRatio: '16:9' },
  },
  {
    id: 'extract-frames',
    version: 1,
    label: 'Extract frames',
    description: 'Review the panels in an image and save each selected crop.',
    input: { imageRequired: true },
    review: 'required',
    output: 'source-crops',
  },
] as const satisfies ReadonlyArray<ImageSkillDefinition>

export const PROMPT_IMAGE_SKILLS = IMAGE_SKILLS.filter(
  (skill) => skill.id === 'storyboard',
)
export const EXTRACT_FRAMES_SKILL = IMAGE_SKILLS[1]

export type PromptInvocation =
  | { kind: 'plain'; text: string }
  | {
      kind: 'skill'
      skillId: 'storyboard'
      brief: string
      originalInput: string
      shots: number
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

export function storyboardShotCount(brief: string): number {
  const explicit = brief.match(/(?:^|\s)--shots(?:=|\s+)(\S+)/i)
  if (/(?:^|\s)--shots(?:\s|=|$)/i.test(brief) && !explicit)
    throw new Error(
      'Storyboard supports 2–9 shots. Add a number after --shots.',
    )
  const natural = brief.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]+(?:shots?|panels?)\b/i,
  )
  const token = explicit?.[1] ?? natural?.[1]
  const count =
    token == null
      ? IMAGE_SKILLS[0].defaults.shots
      : (COUNTS[token.toLowerCase()] ?? Number(token))
  if (!Number.isInteger(count) || count < 2 || count > 9) {
    throw new Error(
      'Storyboard supports 2–9 shots. Use, for example, --shots 4 followed by your scene idea.',
    )
  }
  return count
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
