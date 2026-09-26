import 'server-only'
import { Output, generateObject, generateText } from 'ai'
import sharp from 'sharp'
import { z } from 'zod'
import { MAX_SHOTS } from './rerun'
import type { CastMember, PlannedShot } from './rerun'
import type { SessionFrame } from './references.server'
import castPrompt from '#/lib/prompts/director-rerun-cast.md'
import plannerPrompt from '#/lib/prompts/director-rerun.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'

/** What the cast call sees: enough to read a face, small enough that thirty
 *  stills are one quick call. The inventory's width, for its reason. */
const CAST_WIDTH = 768

/** More than this is background counted as cast -- the inventory's cap. */
const MAX_CAST = 6

const castSchema = z.object({
  look: z.string(),
  characters: z.array(
    z.object({ name: z.string().min(1), description: z.string().min(1) }),
  ),
})

/**
 * The cast in prose, from one vision call over stills of the source cut
 * (#744). Prose, not sheets: a sheet is a Nano Banana image per element, the
 * slow and paid part, and a text-to-video shot cannot take one anyway.
 */
export async function writeCast({
  frames,
  prompts,
}: {
  frames: Array<SessionFrame>
  prompts: Array<string>
}): Promise<{ look: string; characters: Array<CastMember> }> {
  requireAiRole('vision')
  const thumbnails = await Promise.all(
    frames.map((frame) =>
      sharp(frame.bytes)
        .resize(CAST_WIDTH, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer(),
    ),
  )
  const content: Array<
    { type: 'text'; text: string } | { type: 'image'; image: string }
  > = [
    {
      type: 'text',
      text: `The clips were generated from these prompts, in order:\n\n${prompts.join('\n\n')}`,
    },
  ]
  thumbnails.forEach((thumbnail, index) => {
    content.push({ type: 'text', text: `Still ${index + 1}:` })
    content.push({
      type: 'image',
      image: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
    })
  })
  const { object } = await generateObject({
    model: ai.vision,
    maxOutputTokens: 4096,
    system: castPrompt,
    schema: castSchema,
    messages: [{ role: 'user', content }],
  })
  const characters = object.characters.slice(0, MAX_CAST)
  if (characters.length === 0)
    throw new Error('Nobody in these clips reads as cast.')
  return { look: object.look, characters }
}

/* Field order is writing order, the chat's lesson: the story is written out
   whole before it is cut, so the shots serve a shape rather than each
   following the last. No array length constraints -- Anthropic's native output
   format rejects them -- so the count is clamped below. */
const planSchema = z.object({
  story: z.string().min(1),
  scenes: z.array(z.object({ description: z.string().min(1) })),
  shots: z.array(
    z.object({
      scene: z.number(),
      action: z.string().min(1),
      speaker: z.string(),
      spoken: z.string(),
    }),
  ),
})

export interface CutPlan {
  story: string
  scenes: Array<string>
  shots: Array<PlannedShot>
}

/**
 * One planning call: the story extracted, the places named, the shots cut
 * (#744). Sonnet 5, the chat's model, at medium effort rather than the chat's
 * low -- this is one call for a whole film rather than one per question, and
 * a planner that drops a line of dialogue is the failure worth thinking to
 * avoid.
 */
export async function planCut(input: {
  /** The cast as prose, each member led by the name shots should use. */
  cast: string
  /** Either a stored story, or the clip prompts, in order. */
  source: { story: string | null; prompts: Array<string> }
}): Promise<CutPlan> {
  requireAiRole('chat')
  const { output } = await generateText({
    model: ai.chat,
    system: plannerPrompt,
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive' },
        effort: 'medium',
        structuredOutputMode: 'outputFormat',
      },
    },
    output: Output.object({ schema: planSchema }),
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          cast: input.cast,
          ...(input.source.story
            ? {
                story: input.source.story,
                addedSince: input.source.prompts,
              }
            : { clipPrompts: input.source.prompts }),
          maxShots: MAX_SHOTS,
        }),
      },
    ],
  })
  const scenes = output.scenes.map((scene) => scene.description)
  const shots = output.shots.slice(0, MAX_SHOTS).map((shot) => ({
    ...shot,
    /* A scene number outside the list is the first scene rather than none:
       a shot generated with no place is a shot in a void. */
    scene:
      Math.round(shot.scene) >= 1 && Math.round(shot.scene) <= scenes.length
        ? Math.round(shot.scene)
        : 1,
  }))
  if (shots.length === 0) throw new Error('The planner wrote no shots.')
  return { story: output.story, scenes, shots }
}
