'use server'

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { effectFileBody, effectRegistryEntry, slugify } from '../effect-file'
import { resolveAuth } from '#/lib/server/auth.server'
import { LIGHTING_EFFECTS } from '#/lib/prompts/lighting'

/**
 * Save: the three edits that ship an effect, made rather than described (#562).
 *
 * **It writes to the repo, and it only works under `pnpm dev`.** The deployed
 * filesystem is read-only and ephemeral, so a Save there would either fail or
 * write somewhere that vanishes on the next deploy -- it refuses instead of
 * pretending. That costs nothing, because authoring an effect is the same
 * activity as editing one of these `.md` files by hand, and that has always
 * been a local job.
 *
 * The three:
 *
 * - `src/lib/prompts/lighting/<id>.md` -- the setup, gels still as `{TOKEN}`s.
 * - an entry appended to `LIGHTING_EFFECTS`, with the gels as its defaults.
 * - `public/lighting/<id>.webp` -- the candidate you picked, square, the way
 *   `public/shots/` holds the angle tiles. The dialog finds it by name; there
 *   is no path in the registry to keep in step.
 *
 * **The result is a diff, not a deployment.** Nothing is live until it is
 * committed, which is the property that makes writing files acceptable here at
 * all: `git status` is the review step, and a bad effect is `git checkout`.
 *
 * **An id already in the registry is refused.** Overwriting would silently
 * replace an effect that other work may already be judging, and the fix -- a
 * different name -- is one field away.
 */

const THUMB_EDGE = 512

export interface SavedEffect {
  id: string
  files: Array<string>
}

export async function saveLightingEffect(data: {
  name: string
  setup: string
  gels: Array<{ token: string; color: string }>
  /** The chosen candidate, as the FAL URL the grid is showing. */
  thumbnailUrl: string
}): Promise<SavedEffect> {
  await resolveAuth()

  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'Saving writes files into the repo, so it only works under `pnpm dev`.',
    )
  }

  const id = slugify(data.name)
  if (!id) throw new Error('Give the effect a name first')
  if (LIGHTING_EFFECTS.some((e) => e.id === id)) {
    throw new Error(
      `There is already an effect called "${id}". Rename this one.`,
    )
  }
  if (!data.setup.trim()) throw new Error('There is no setup to save')

  const root = process.cwd()
  const effect = {
    id,
    name: data.name.trim(),
    setup: data.setup,
    gels: data.gels,
  }

  // The thumbnail first: it is the one step that can fail on something outside
  // this machine, and a registry entry pointing at a picture that was never
  // written is the one broken state worth avoiding.
  const response = await fetch(data.thumbnailUrl)
  if (!response.ok) throw new Error('Could not read the candidate image')
  const webp = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()
  await writeFile(join(root, 'public/lighting', `${id}.webp`), webp)

  await writeFile(
    join(root, 'src/lib/prompts/lighting', `${id}.md`),
    effectFileBody(effect),
    'utf8',
  )

  const registryPath = join(root, 'src/lib/prompts/lighting/index.ts')
  const source = await readFile(registryPath, 'utf8')
  const close = '\n] as const'
  if (!source.includes(close)) {
    throw new Error('Could not find the end of LIGHTING_EFFECTS to append to')
  }
  await writeFile(
    registryPath,
    source.replace(close, `\n${effectRegistryEntry(effect)}${close}`),
    'utf8',
  )

  return {
    id,
    files: [
      `src/lib/prompts/lighting/${id}.md`,
      'src/lib/prompts/lighting/index.ts',
      `public/lighting/${id}.webp`,
    ],
  }
}
