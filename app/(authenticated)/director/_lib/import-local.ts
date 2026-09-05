import { importCut, loadSession, newSession } from '../_actions/sessions.action'
import { draftKey, readCut } from '../clip-store'
import { clipFrame } from '../clip-frame'
import { emptyCut } from '../clips'
import { listTakes, readInitialImage } from '../recording'
import { readSession } from '../session-state'
import { emptyStoredCut } from './types'
import { uploadMedia } from './upload'
import type { StoredClip } from './types'

export async function localCutAvailable(owner: string) {
  const saved = await readCut(owner)
  return !!(
    saved?.clips.length ||
    saved?.pending ||
    saved?.initialImage ||
    localStorage.getItem(draftKey(owner)) ||
    (await listTakes(owner)).length
  )
}
export async function importLocal(
  owner: string,
  progress: (message: string) => void,
) {
  const key = `genzen-director-import-${owner}`
  let id = localStorage.getItem(key)
  if (id) {
    const existing = await loadSession(id)
    if (existing && existing.revision > 0) return id
    if (!existing) id = null
  }
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  await newSession('Imported Lab session', id)
  const saved = await readCut(owner)
  const cut = saved ?? emptyCut()
  const takes = await listTakes(owner)
  let draft = localStorage.getItem(draftKey(owner)) ?? ''
  if (!saved) {
    const legacy = readSession(localStorage, owner)
    draft ||= legacy?.draft ?? ''
    cut.initialImage = await readInitialImage(owner)
    const selected =
      takes.find((take) => take.id === legacy?.previewId) ??
      [...takes].sort((a, b) => b.startedAt - a.startedAt).at(0)
    if (selected)
      cut.clips = [
        {
          id: selected.id,
          prompt: (
            legacy?.directions.map((d) => d.prompt).join('\n') ||
            'Saved Director scene'
          ).slice(0, 2000),
          blob: selected.blob,
          ...(await clipFrame(selected.blob)),
          model: 'Director recording',
          imported: true,
        },
      ]
  }
  const stored = {
    ...emptyStoredCut(),
    settings: cut.settings,
    pending: cut.pending,
  }
  const uploaded = new Map<string, string>()
  for (const [index, clip] of cut.clips.entries()) {
    progress(`Saving section ${index + 1} of ${cut.clips.length}...`)
    const media = await uploadMedia(id, clip.blob)
    if (!media.endFrameId || !media.thumbnailId || !media.duration)
      throw new Error('Could not prepare the imported clip.')
    stored.clips.push({
      id: clip.id,
      prompt: clip.prompt,
      model: clip.model,
      imported: clip.imported,
      elapsedMs: clip.elapsedMs,
      ...media,
    } as StoredClip)
    uploaded.set(clip.id, media.mediaId)
  }
  if (cut.initialImage)
    stored.initialImage = (await uploadMedia(id, cut.initialImage)).mediaId
  for (const take of takes) {
    progress('Preserving original recordings...')
    const mediaId =
      uploaded.get(take.id) ?? (await uploadMedia(id, take.blob)).mediaId
    stored.archives.push({
      id: take.id,
      mediaId,
      startedAt: take.startedAt,
      complete: take.complete,
      mimeType: take.mimeType,
    })
  }
  const backup = localStorage.getItem(`${draftKey(owner)}-receipt`)
  if (stored.pending && backup) {
    const accepted = JSON.parse(backup)
    if (accepted.id === stored.pending.id && typeof accepted.token === 'string')
      stored.pending.token = accepted.token
  }
  progress('Saving session...')
  await importCut(id, stored, draft)
  return id
}
