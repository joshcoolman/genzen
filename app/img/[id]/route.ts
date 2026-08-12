import { first, sql } from '#/lib/server/db.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { createImageStorage } from '#/lib/image-storage'
import { parseRange } from '#/lib/http-range'

/**
 * Serve an image, to its owner only (#226).
 *
 * The app was deny-by-default at the front door and then handed out object URLs
 * that needed no session at all. This is the window being closed: identity comes
 * from the cookie via `resolveAuth()`, the row is fetched with an explicit
 * `user_id`, and a miss is a 404 either way -- a 403 would confirm the id names
 * something real.
 *
 * `?v=thumb` serves `thumbnail_path`, falling back to the original when one was
 * never generated. The grid must not pull full-size objects (#215).
 *
 * Cached `private`: the response is per-user, so a shared cache must never hold
 * it, but the browser should. Objects are immutable once written -- a new image
 * is a new row and a new URL -- so the max-age is long and there is nothing to
 * invalidate.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response('Not found', { status: 404 })
  }

  const { userId } = await resolveAuth()

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
  if (!row?.storage_path) return new Response('Not found', { status: 404 })

  const wantsThumb =
    new URL(request.url).searchParams.get('v') === 'thumb' &&
    !!row.thumbnail_path
  const key = wantsThumb ? row.thumbnail_path! : row.storage_path

  let blob
  try {
    blob = await createImageStorage().download(key)
  } catch {
    // The row survives its object often enough to matter -- a failed upload
    // rollback, a bucket wiped by `local:reset`. A 404 renders as a broken
    // card; a 500 renders as a broken app.
    return new Response('Not found', { status: 404 })
  }

  // Thumbnails are WebP whatever the original was.
  const contentType = wantsThumb
    ? 'image/webp'
    : blob.type || row.mime_type || 'application/octet-stream'
  const cacheControl = 'private, max-age=31536000, immutable'

  // A `<video>` element cannot seek unless the server answers a range request:
  // without this it streams from byte zero and the scrub bar does nothing
  // (#305). Stills never ask, so this costs them nothing.
  const range = parseRange(request.headers.get('range'), blob.size)
  if (range) {
    const { start, end } = range
    return new Response(blob.slice(start, end + 1).stream(), {
      status: 206,
      headers: {
        'content-type': contentType,
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${blob.size}`,
        'accept-ranges': 'bytes',
        'cache-control': cacheControl,
      },
    })
  }

  return new Response(blob.stream(), {
    headers: {
      'content-type': contentType,
      'content-length': String(blob.size),
      'accept-ranges': 'bytes',
      'cache-control': cacheControl,
    },
  })
}
