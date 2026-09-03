'use server'

import { generateImageInternal } from '#/features/ai-images/server/generate-image-internal.server'
import studio from '#/lib/prompts/people/studio.md'

/** 4:5, the headshot standard, and not a control. Crop distance is what makes
 *  a set read as one shoot; the ratio only makes the grid tidy. */
const ASPECT_RATIO = '4:5'

/**
 * One person, submitted the way every other generation in the app is (#578).
 *
 * **This page held its results in the browser for a day and does not any
 * more.** Storing nothing looked right -- a triage board is thrown away, so why
 * write rows for faces about to be rejected -- and it cost the three things
 * the app's own pipeline gives for free: a reload lost the board, the FAL urls
 * it held expired, and none of the spend appeared in Activity. Reserving a row
 * per press instead means a face is an ordinary picture from the moment it is
 * asked for: it survives a refresh, it is in Images, discard is the gallery's
 * own delete, and Keep stops being a concept.
 *
 * **Two things stay this page's own**, because the library has no idea about
 * either: which press a face belongs to, and which face it was riffed off.
 * Those live in `board.ts`, keyed by the record id this returns.
 *
 * **The prompt is assembled here**, `studio.md` first, so every tile was shot
 * in the same room whatever wrote the person.
 *
 * A `+` press briefly skipped the writer altogether and reused the parent's
 * spec with a clause asking for someone else from that bucket. It was fast and
 * the faces came back too alike -- a spec that names a mole and a jaw is a
 * description of a person however it is framed. Haiku writes the riff instead,
 * which costs a second or two and is the whole reason the tiles are reserved
 * before anyone is written into them.
 */
export async function submitPerson(data: {
  /** One person's paragraph. */
  spec: string
  /** A picker id from `PEOPLE_MODELS`. */
  modelId: string
}): Promise<{ recordId: string }> {
  const spec = data.spec.trim()
  if (!spec) throw new Error('No person to render')

  const prompt = `${studio.trim()}\n\nThe person: ${spec}`

  const { recordId } = await generateImageInternal({
    prompt,
    model: data.modelId,
    // The lab has no origin of its own and should not add one: `origin` says
    // which *surface* authored a generation, and what these are is pictures in
    // the library, which is what Images means here.
    origin: 'images',
    aspectRatio: ASPECT_RATIO,
  })

  return { recordId }
}
