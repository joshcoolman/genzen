import 'server-only'
import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import system from '#/lib/prompts/director-chat.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'

/** The most clips one answer may take: six five-second bursts (#670). */
export const MAX_ANSWER_CLIPS = 6

const clipSchema = z.object({
  action: z.string().min(1),
  spoken: z.string(),
  duration: z.number(),
})

/**
 * Field order is writing order: the model fills a structured object top to
 * bottom, so `line` before `clips` means the answer is composed as speech
 * first and cut into bursts after. The other way round -- clips first, line
 * as their concatenation -- had the model thinking in five-second units from
 * the start, and a six-burst answer wandered, each sentence following the
 * last rather than serving a shape.
 */
const answerSchema = z.object({
  character: z.string().min(1),
  title: z.string(),
  scene: z.string(),
  line: z.string(),
  // No `.min`/`.max` on the array: Anthropic's native output format rejects
  // array length constraints, so the count is clamped below instead.
  clips: z.array(clipSchema),
})

export interface AnswerClip {
  /** What happens on camera in this burst, with the line in quotes. The
   *  character and the scene are not in it -- see `composeClipPrompt`. */
  action: string
  spoken: string
  duration: number
}

export interface CharacterAnswer {
  character: string
  /** A name for the conversation, from the first question. */
  title: string
  /** Where and how this answer is shot, written once for all its clips. */
  scene: string
  line: string
  clips: Array<AnswerClip>
}

/**
 * The prompt one burst is generated from: the anchors, then the action.
 *
 * The model writes the character once per session and the scene once per
 * answer, and the code puts them in front of every clip. Continuity by
 * repetition was the first cut -- every clip prompt restated the whole
 * description -- and it worked, at the cost of the model writing five times
 * the words; a turn went from eight seconds to fifteen when the bursts came
 * in. The picture FAL sees is the same either way, so the anchors are
 * prepended here and the model writes only what changes.
 *
 * The line is appended here too, in quotes, because the model keeps action
 * and speech apart when asked for both as fields -- and a clip whose prompt
 * has no quoted line is a silent one.
 */
export function composeClipPrompt(
  character: string,
  scene: string,
  action: string,
  spoken: string,
): string {
  const line = spoken.trim().replace(/^["\u201c]+|["\u201d]+$/g, '')
  return [
    'Vertical 9:16 video, the character facing the camera.',
    character.trim(),
    scene.trim(),
    action.trim(),
    line && `Speaking to camera: "${line}"`,
  ]
    .filter(Boolean)
    .join(' ')
}

/** The nearest length the video model offers to what the writer asked for. */
export function nearestDuration(
  durations: ReadonlyArray<number>,
  wanted: number,
): number {
  return durations.reduce((best, d) =>
    Math.abs(d - wanted) < Math.abs(best - wanted) ? d : best,
  )
}

/**
 * Bring a model's answer to what the video model can make: one to three
 * clips, each at a duration the lineup offers.
 */
export function clampAnswer(
  answer: CharacterAnswer,
  durations: ReadonlyArray<number>,
): CharacterAnswer {
  const clips = answer.clips.slice(0, MAX_ANSWER_CLIPS)
  if (clips.length === 0) throw new Error('The character had nothing to say.')
  return {
    ...answer,
    clips: clips.map((clip) => ({
      ...clip,
      duration: nearestDuration(durations, clip.duration),
    })),
  }
}

/**
 * One Claude call per turn (#670): the question, the transcript so far and the
 * character if there is one; back come the character and one to three clip
 * prompts. Opus at low effort, because the output is three short prompts and
 * the wait that matters is the clip's. Web search is on a short
 * leash -- the prompt says once, first good result -- so an answer that needs
 * a fact costs seconds rather than a research session.
 */
export async function answerAsCharacter(input: {
  character: string | null
  transcript: Array<{ question: string; line: string }>
  question: string
  durations: ReadonlyArray<number>
  /** Who should answer, in the person's words, if they said. First turn
   *  only, and absent from the call entirely when empty: an empty steer is
   *  not a fact the model needs. */
  steer?: string | null
}): Promise<CharacterAnswer> {
  requireAiRole('chat')
  const { output } = await generateText({
    model: ai.chat,
    system,
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive' },
        effort: 'low',
        // Not fast mode: the org's fast-mode limit is zero, and a request
        // carrying `speed: 'fast'` is refused outright rather than slowed
        // down (tried 2026-09-15). Effort is the speed lever that works.
        structuredOutputMode: 'outputFormat',
      },
    },
    tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 2 }) },
    output: Output.object({ schema: answerSchema }),
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          character: input.character,
          ...(!input.character && input.steer?.trim()
            ? { steer: input.steer.trim() }
            : {}),
          transcript: input.transcript,
          question: input.question,
          maxClips: MAX_ANSWER_CLIPS,
          durations: input.durations,
        }),
      },
    ],
  })
  return clampAnswer(output, input.durations)
}
