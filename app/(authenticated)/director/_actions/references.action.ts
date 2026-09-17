'use server'

import {
  DERIVE_MODEL_SLUGS,
  EXTRACT_MODEL_SLUG,
  KIND_NOUN,
  REF_RATIO,
} from '../[id]/refs'
import {
  addSessionRefs,
  refKindOf,
  removeSessionRef,
  requireSession,
} from '../_lib/sessions.server'
import { collectSessionFrames, inventory } from '../_lib/references.server'
import { idSchema } from '../_lib/types'
import type { RefKind, Session } from '../_lib/types'
import characterSheetPrompt from '#/lib/prompts/director-character-sheet.md'
import locationSheetPrompt from '#/lib/prompts/director-location-sheet.md'
import derivePrompt from '#/lib/prompts/director-derive.md'
import { generateImageInternal } from '#/features/ai-images/server/generate-image-internal.server'
import { updateImageMeta } from '#/features/user-images/server/images.action'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

/** The fixed instruction per kind. Prose in `.md`, the pick in code (#322). */
const SHEET_PROMPT: Record<RefKind, string> = {
  characters: characterSheetPrompt,
  locations: locationSheetPrompt,
}

/** What the tab draws. Library rows, read as they are now, so a sheet still
 *  being made shows as pending and settles on the standard poll. */
export interface RefAsset {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'completed' | 'failed'
  generation_error: string | null
  created_at: string
}

/**
 * The session's sheets, in the order they were added (#690).
 *
 * Origin-scoped like the clips: a row that is not Director's is not this
 * session's, whatever the stored id says. Ids that resolve to nothing drop
 * out, which is how a sheet trashed elsewhere leaves the tab.
 */
export async function listSessionRefs(
  sessionId: string,
): Promise<Record<RefKind, Array<RefAsset>>> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  const ids = [...session.refs.characters, ...session.refs.locations]
  if (ids.length === 0) return { characters: [], locations: [] }

  const rows = await sql<Array<RefAsset>>`
    select id, title, description, status, generation_error,
           to_json(created_at)#>>'{}' as created_at
    from user_images
    where user_id = ${userId}
      and id = any(${ids})
      and origin = 'director'
      and deleted_at is null
  `
  const byId = new Map(rows.map((row) => [row.id, row]))
  const pick = (list: Array<string>) =>
    list.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
  return {
    characters: pick(session.refs.characters),
    locations: pick(session.refs.locations),
  }
}

/**
 * Extract one kind's sheets from the session's clips (#690).
 *
 * Stills, one vision pass, then one image generation per element -- all
 * submitted at once, settled by the standard poll like every other generation
 * in the app. Additive: pressing it a second time adds another extraction's
 * worth beside the first, and nothing is replaced. The word is never
 * "regenerate".
 *
 * The frames are recorded on the session even when no sheet comes of them, so
 * they are still trashed with it -- an orphaned still is exactly the kind of
 * row isolation exists to prevent.
 */
export async function extractReferences(
  sessionId: string,
  kind: RefKind,
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))

  const frames = await collectSessionFrames(userId, session.cut.clipIds)
  if (frames.length === 0) {
    throw new Error(
      'No finished clips to read. Wait for the run to render, then try again.',
    )
  }
  const frameIds = frames.map((frame) => frame.imageId)

  const elements = await inventory({
    kind,
    frames,
    character: session.chat?.character,
  })
  if (elements.length === 0) {
    await addSessionRefs(userId, session.id, {}, frameIds)
    throw new Error(`Nothing in these clips reads as a ${KIND_NOUN[kind]}.`)
  }

  /* Settled, not all-or-nothing, on `askCharacter`'s reasoning: a submit that
     failed has already left a failed row, and the ones that went through are
     being made and paid for. */
  const submitted = await Promise.allSettled(
    elements.map(async (element) => {
      const { recordId } = await generateImageInternal({
        prompt: `${SHEET_PROMPT[kind]}\n\nThe subject: ${element.description}`,
        model: EXTRACT_MODEL_SLUG,
        origin: 'director',
        aspectRatio: REF_RATIO,
        referenceImageIds: element.frameIds,
      })
      /* The element's own name, so the tab reads as the film rather than as a
         list of model badges. The description travels with it: it is what the
         sheet was drawn from, and the only account of why this sheet is this
         element. */
      await updateImageMeta(recordId, element.name, element.description)
      return recordId
    }),
  )
  const made = submitted.flatMap((s) =>
    s.status === 'fulfilled' ? [s.value] : [],
  )

  const saved = await addSessionRefs(
    userId,
    session.id,
    kind === 'characters' ? { characters: made } : { locations: made },
    frameIds,
  )
  if (made.length === 0) {
    const failed = submitted[0]
    throw failed.status === 'rejected' && failed.reason instanceof Error
      ? failed.reason
      : new Error('The sheets could not be generated.')
  }
  return saved
}

/**
 * New from this (#690): one more asset, from one sheet plus some words.
 *
 * One generation per model ticked, each with the selected sheet as its only
 * reference, added to the tab the sheet is on. The sheet itself is untouched
 * -- a derived asset is a sheet too, so the next derive can start from it.
 */
export async function deriveReference(
  sessionId: string,
  assetId: string,
  words: string,
  modelSlugs: Array<string>,
): Promise<Session> {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  idSchema.parse(assetId)

  const kind = refKindOf(session, assetId)
  if (!kind) throw new Error('That sheet is not in this session.')

  const asked = words.trim().slice(0, 2000)
  if (!asked) throw new Error('Say what you want made from it.')

  const models = modelSlugs.filter((slug) =>
    (DERIVE_MODEL_SLUGS as ReadonlyArray<string>).includes(slug),
  )
  if (models.length === 0) throw new Error('Pick at least one model.')

  const source = first(
    await sql<Array<{ title: string }>>`
      select title from user_images
      where id = ${assetId} and user_id = ${userId}
        and origin = 'director' and deleted_at is null
    `,
  )
  if (!source) throw new Error('That sheet is not here any more.')

  const submitted = await Promise.allSettled(
    models.map(async (model) => {
      const { recordId } = await generateImageInternal({
        prompt: `${derivePrompt}\n\n${asked}`,
        typedPrompt: asked,
        model,
        origin: 'director',
        aspectRatio: REF_RATIO,
        referenceImageIds: [assetId],
      })
      await updateImageMeta(recordId, source.title, asked)
      return recordId
    }),
  )
  const made = submitted.flatMap((s) =>
    s.status === 'fulfilled' ? [s.value] : [],
  )
  if (made.length === 0) {
    const failed = submitted[0]
    throw failed.status === 'rejected' && failed.reason instanceof Error
      ? failed.reason
      : new Error('Nothing could be generated from that sheet.')
  }
  return addSessionRefs(
    userId,
    session.id,
    kind === 'characters' ? { characters: made } : { locations: made },
  )
}

/** Delete one asset: off the tab, into Trash (#690). */
export async function dropReference(
  sessionId: string,
  assetId: string,
): Promise<Session> {
  const { userId } = await resolveAuth()
  return removeSessionRef(
    userId,
    idSchema.parse(sessionId),
    idSchema.parse(assetId),
  )
}
