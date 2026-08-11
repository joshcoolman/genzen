'use server'

import { first, sql } from '#/lib/server/db.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { createImageStorage } from '#/lib/image-storage'

/** Our own image URLs are `/img/<uuid>` (`src/lib/image-url.ts`), optionally
 *  with `?v=thumb`. Returns the row id, or null for anything else. */
function ourImageId(url: string): string | null {
  const match = /^\/img\/([0-9a-f-]{36})(?:\?|$)/i.exec(url)
  return match ? match[1] : null
}

/**
 * Load an image as a data URL, for the panel to preview.
 *
 * Our own images are read straight off the bucket, never over HTTP (#226). Two
 * reasons, and either alone is enough: `/img/<id>` is a relative path, which
 * `fetch` on the server cannot resolve at all -- it threw `Invalid URL` and
 * broke every library source pick (#291) -- and even absolutised, the app
 * would be issuing a cookie-less request to itself, which that route correctly
 * 404s. The bytes are right there; the round trip was never the point.
 *
 * Everything else (FAL results, canvas signed URLs) is genuinely remote and
 * still goes over the wire.
 */
export async function fetchImageAsBase64(data: { url: string }) {
  const { userId } = await resolveAuth()

  const id = ourImageId(data.url)
  if (id) {
    const row = first(
      await sql<
        Array<{
          storage_path: string | null
          thumbnail_path: string | null
          mime_type: string | null
        }>
      >`
        select storage_path, thumbnail_path, mime_type
        from user_images
        where id = ${id} and user_id = ${userId}
      `,
    )
    if (!row?.storage_path) throw new Error('Image not found')

    // Deliberately the full object even when the URL asked for `?v=thumb`:
    // that variant exists so the grid does not pull full-size images, and this
    // is the copy that gets sent to a model.
    const blob = await createImageStorage().download(row.storage_path)
    const buffer = await blob.arrayBuffer()
    const contentType = row.mime_type ?? 'image/png'
    return {
      base64: `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`,
    }
  }

  const response = await fetch(data.url)
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') ?? 'image/png'
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64: `data:${contentType};base64,${base64}` }
}
