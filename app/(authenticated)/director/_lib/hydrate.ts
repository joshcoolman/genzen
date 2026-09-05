import { mediaUrl } from './types'
import type { StoredCut } from './types'
import type { Cut } from '../clips'
import type { SavedTake } from '../recording'

export async function hydrateCut(
  stored: StoredCut,
  cache: Map<string, Blob>,
): Promise<{ cut: Cut; archives: Array<SavedTake> }> {
  async function blob(id: string) {
    const cached = cache.get(id)
    if (cached) return cached
    const response = await fetch(mediaUrl(id))
    if (!response.ok)
      throw new Error('Some saved media could not load. Reload to retry.')
    const value = await response.blob()
    cache.set(id, value)
    return value
  }
  const clips: Cut['clips'] = []
  // Bound simultaneous downloads; an old cut can contain dozens of large clips.
  for (const clip of stored.clips) {
    const [video, frame] = await Promise.all([
      blob(clip.mediaId),
      blob(clip.endFrameId),
    ])
    clips.push({ ...clip, blob: video, endFrame: frame })
  }
  const archives: Array<SavedTake> = []
  for (const archive of stored.archives)
    archives.push({ ...archive, blob: await blob(archive.mediaId) })
  return {
    cut: {
      ...stored,
      clips,
      initialImage: stored.initialImage
        ? await blob(stored.initialImage)
        : null,
    },
    archives,
  }
}
