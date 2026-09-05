import { UPLOAD_CHUNK_BYTES, exportManifestSchema } from './export-policy'
import type { Clip } from './clips'

export function selectedClips(
  clips: Array<Clip>,
  selected: ReadonlySet<string>,
) {
  return clips.filter((clip) => selected.has(clip.id))
}

/** Export a snapshot, not the live cut. No provider calls or persistent writes. */
export async function exportCut(
  clips: Array<Clip>,
  progress: (message: string) => void,
  signal: AbortSignal,
) {
  const manifest = exportManifestSchema.parse(
    clips.map((clip) => ({ size: clip.blob.size, duration: clip.duration })),
  )
  let id: string | undefined
  async function post(operation: string, body?: BodyInit, extra = '') {
    const response = await fetch(
      `/lab/director/export?operation=${operation}${id ? `&id=${encodeURIComponent(id)}` : ''}${extra}`,
      {
        method: 'POST',
        body,
        signal,
      },
    )
    if (!response.ok)
      throw new Error(
        'Export failed. Your saved clips are unchanged; please try again.',
      )
    return response
  }
  try {
    progress('Preparing temporary export…')
    const created = await (
      await post('create', JSON.stringify(manifest))
    ).json()
    if (typeof created.id !== 'string')
      throw new Error('Could not create export.')
    id = created.id
    const total = manifest.reduce((sum, clip) => sum + clip.size, 0)
    let sent = 0
    for (const [index, clip] of clips.entries()) {
      for (
        let offset = 0;
        offset < clip.blob.size;
        offset += UPLOAD_CHUNK_BYTES
      ) {
        const chunk = clip.blob.slice(offset, offset + UPLOAD_CHUNK_BYTES)
        progress(
          `Uploading section ${index + 1} of ${clips.length} · ${Math.round((sent / total) * 100)}%`,
        )
        await post('upload', chunk, `&index=${index}&offset=${offset}`)
        sent += chunk.size
      }
    }
    progress(`Stitching ${clips.length} sections into a silent MP4…`)
    const response = await post('finish')
    const blob = await response.blob()
    if (!blob.size) throw new Error('The exported file was empty.')
    progress('Ready to download · no copy saved to the library')
    return blob
  } finally {
    // Finish also removes its files. This covers interrupted/failed uploads;
    // an abandoned tab has a server-side expiry as a second cleanup path.
    if (id)
      void fetch(
        `/lab/director/export?operation=discard&id=${encodeURIComponent(id)}`,
        {
          method: 'POST',
          keepalive: true,
        },
      ).catch(() => {})
  }
}
