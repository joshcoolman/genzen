'use server'

import { generateObject } from 'ai'
import { z } from 'zod'
import castPrompt from '#/lib/prompts/people/cast.md'
import moreLikePrompt from '#/lib/prompts/people/more-like.md'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { resolveAuth } from '#/lib/server/auth.server'

/**
 * The cast: N people written in one call, knowing all N (#578).
 *
 * **This is not optional, and the test that proved it cost thirty cents.** The
 * cheap version -- one prompt carrying "any gender, any ethnicity, chosen
 * freely" and pressed ten times -- returned ten East Asian men in their late
 * twenties, several of them arguably the same man, and pressing again twice
 * more returned to the same face. Thirty images, one person. Ten specs written
 * as a set returned ten people across both genders, eight ethnicities and four
 * age decades, and held that across three separate casts. An independent call
 * cannot know what the other nine produced, so nothing inside a single prompt
 * can spread a set.
 *
 * **Temperature 1 rather than the default**, because the requirement is not
 * only that one cast spreads but that the next press differs from this one.
 *
 * **A press of one gets the board as context.** Asking for a single person
 * repeatedly is the same shape as the failure above -- independent calls, each
 * blind to the others -- so the people already on screen are sent along with
 * the ask. The last two dozen, not all of them: the spread that matters is
 * against what is in front of you, and the prompt should not grow without
 * bound over an afternoon.
 *
 * **It throws without `ANTHROPIC_API_KEY`.** Locally that key is usually empty,
 * and the failure mode being guarded is specific: a silent fall back to one
 * repeated prompt would still return images, and they would all be the same
 * person.
 */

const schema = z.object({
  people: z
    .array(
      z
        .string()
        .describe(
          'One person as a single paragraph: age, gender, ethnicity, hair, face, build, skin, one or two ordinary details, then the expression.',
        ),
    )
    .describe('The cast, in no particular order'),
})

function clampCount(count: number): number {
  if (!Number.isFinite(count)) throw new Error('How many people?')
  // No upper limit is a deliberate product decision -- thirty on Z-Image Turbo
  // is fifteen cents and a reasonable thing to try -- but a cast is one model
  // call with a finite output, and past this it stops being written as a set.
  return Math.min(Math.max(Math.round(count), 1), 40)
}

export async function writeCast(data: {
  count: number
  /** Everyone already on the board. The page is used one press at a time, and
   *  an independent call cannot know what the last one produced -- so the
   *  board is handed back as the history to differ from. Without it, ten
   *  presses of one button are the failure this whole approach exists to
   *  avoid. */
  avoid?: Array<string>
}): Promise<Array<string>> {
  await resolveAuth()
  requireAiRole(data.count > 3 ? 'reasoning' : 'fast')

  const count = clampCount(data.count)
  const { object } = await generateObject({
    // Sonnet for a cast, Haiku for a handful. The hard part of this prompt is
    // spreading ten people across gender, ethnicity and age without being told
    // how; one or two people, with the board attached as the thing to differ
    // from, is a much smaller job -- and it sits behind a button pressed over
    // and over, where ten seconds of Sonnet is the whole experience.
    model: count > 3 ? ai.reasoning : ai.fast,
    maxOutputTokens: 8000,
    temperature: 1,
    system: castPrompt,
    schema,
    prompt: [
      `Write a cast of ${count} ${count === 1 ? 'person' : 'people'}.`,
      ...(data.avoid?.length
        ? [
            'These people are already in this set. Write someone who is not any of them, and who differs from all of them in gender, ethnicity or age band rather than only in hair:',
            data.avoid.slice(-24).join('\n\n'),
          ]
        : []),
    ].join('\n\n'),
  })

  const people = object.people.map((p) => p.trim()).filter(Boolean)
  if (people.length === 0) throw new Error('The cast came back empty')
  return people.slice(0, count)
}

/**
 * More people from one person's bucket -- same gender, ethnicity and rough age,
 * different faces.
 *
 * **Haiku, not Sonnet.** The cast call is the hard one -- ten people who have
 * to spread across gender, ethnicity and age without being told which. This is
 * one bucket and a handful of faces, and it sits behind the `+` button, which
 * is pressed three times in a row while looking at a face. Seconds matter more
 * here than they do anywhere else on the page.
 *
 * **Written from the spec, not from the picture.** The obvious implementation
 * hands the tile back to the model as a reference image, and the obvious
 * failure follows: a model given a face reads a *person*, not a category, and
 * "clearly different people" is a negation it cannot check itself against, so
 * what comes back are cousins. The spec that made the tile is already in hand
 * and describes exactly the bucket, so there is no reason to put a face into
 * the pipeline at all.
 */
export async function writeMoreLike(data: {
  spec: string
  count: number
}): Promise<Array<string>> {
  await resolveAuth()
  requireAiRole('fast')

  const spec = data.spec.trim()
  if (!spec) throw new Error('That tile has no description to work from')
  const count = clampCount(data.count)

  const { object } = await generateObject({
    model: ai.fast,
    maxOutputTokens: 4000,
    temperature: 1,
    system: `${castPrompt}\n\n${moreLikePrompt}`,
    schema,
    prompt: `Here is the person:\n\n${spec}\n\nWrite ${count} more people like them.`,
  })

  const people = object.people.map((p) => p.trim()).filter(Boolean)
  if (people.length === 0) throw new Error('Nothing came back')
  return people.slice(0, count)
}
