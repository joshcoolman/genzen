import 'server-only'
import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import system from '#/lib/prompts/director-chat.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'

/** The most clips one answer may take (#670). */
export const MAX_ANSWER_CLIPS = 3

const clipSchema = z.object({
  prompt: z.string().min(1),
  spoken: z.string(),
  duration: z.number(),
})

const answerSchema = z.object({
  character: z.string().min(1),
  title: z.string(),
  line: z.string(),
  // No `.min`/`.max` on the array: Anthropic's native output format rejects
  // array length constraints, so the count is clamped below instead.
  clips: z.array(clipSchema),
})

export interface AnswerClip {
  prompt: string
  spoken: string
  duration: number
}

export interface CharacterAnswer {
  character: string
  /** A name for the conversation, from the first question. */
  title: string
  line: string
  clips: Array<AnswerClip>
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
