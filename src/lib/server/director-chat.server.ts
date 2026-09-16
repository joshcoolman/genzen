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
})

/**
 * Field order is writing order: the model fills a structured object top to
 * bottom, so `line` before `clips` means the answer is composed as speech
 * first and cut into bursts after. The other way round -- clips first, line
 * as their concatenation -- had the model thinking in five-second units from
 * the start, and a six-burst answer wandered, each sentence following the
 * last rather than serving a shape.
 */
const paceSchema = z.enum(['normal', 'quick'])
export type Pace = z.infer<typeof paceSchema>

const answerSchema = z.object({
  character: z.string().min(1),
  title: z.string(),
  scene: z.string(),
  line: z.string(),
  pace: paceSchema,
  // No `.min`/`.max` on the array: Anthropic's native output format rejects
  // array length constraints, so the count is clamped below instead.
  clips: z.array(clipSchema),
})

export interface AnswerClip {
  /** What happens on camera in this burst, with the line in quotes. The
   *  character and the scene are not in it -- see `composeClipPrompt`. */
  action: string
  spoken: string
  /** Seconds, set here from the word count -- never by the model. */
  duration: number
}

export interface CharacterAnswer {
  character: string
  /** A name for the conversation, from the first question. */
  title: string
  /** Where and how this answer is shot, written once for all its clips. */
  scene: string
  /** How fast this character talks, so the timing honours the voice. */
  pace: Pace
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
  /* "Speaking English" leads, before the character: the front of a prompt is
     weighted heaviest, and the odd burst still came out as language-shaped
     sound. Said again beside the line for the same reason. */
  return [
    'Vertical 9:16 video, the character facing the camera and speaking English.',
    character.trim(),
    scene.trim(),
    action.trim(),
    line && `Speaking to camera, in English: "${line}"`,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * How long a burst runs, from how many words it has to say.
 *
 * Set in code, never by the model. It used to be a field the model filled,
 * with the lineup's durations passed in as data for it to choose from -- and
 * it dealt them out in order, 5, 6, 8, 10, 12, 15, one per burst. The last
 * burst of that turn had seventeen words to fill fifteen seconds, and at a
 * third of speaking pace the audio model padded with language-shaped sounds
 * that were not English or anything else. Words per second is what decides
 * whether a line is spoken cleanly, so it is the one thing this computes.
 *
 * The pace is the character's, marked once per answer, so the voice the
 * description asks for and the seconds the clip gets agree. When they did
 * not -- a "deliberate" voice at four words a second -- each burst resolved
 * the conflict differently, which is what a voice changing between bursts
 * sounds like. There is no slow: a burst that suddenly drags is as wrong
 * as one that garbles, and the energy is meant to hold from clip to clip.
 * Normal is just under three words a second, comfortable delivery with a
 * beat to breathe, which the action is written to fill. The shortest lineup
 * duration that keeps under the pace, so a short line stays a five-second
 * burst and a long one gets the room it needs.
 */
export const WORDS_PER_SECOND: Record<Pace, number> = {
  normal: 2.8,
  quick: 3.2,
}

export function durationForWords(
  words: number,
  durations: ReadonlyArray<number>,
  pace: Pace = 'normal',
): number {
  const sorted = [...durations].sort((a, b) => a - b)
  const limit = WORDS_PER_SECOND[pace]
  return (
    sorted.find((seconds) => words / seconds <= limit) ??
    sorted[sorted.length - 1]
  )
}

/**
 * Bring a model's answer to what the video model can make: one to six
 * clips, each timed to its line.
 */
export function clampAnswer(
  answer: Omit<CharacterAnswer, 'clips'> & {
    clips: Array<Omit<AnswerClip, 'duration'>>
  },
  durations: ReadonlyArray<number>,
): CharacterAnswer {
  const clips = answer.clips.slice(0, MAX_ANSWER_CLIPS)
  if (clips.length === 0) throw new Error('The character had nothing to say.')
  return {
    ...answer,
    clips: clips.map((clip) => ({
      ...clip,
      duration: durationForWords(
        clip.spoken.trim().split(/\s+/).filter(Boolean).length,
        durations,
        answer.pace,
      ),
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
        }),
      },
    ],
  })
  return clampAnswer(output, input.durations)
}
