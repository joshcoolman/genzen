import {
  buildReferenceSheet,
  referenceSheetFileName,
} from '#/lib/server/reference-sheet.server'
import { resolveAuth } from '#/lib/server/auth.server'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * POST a selection of image ids, get one composited sheet back as a PNG (#476).
 *
 * **A route returning a blob, not a server action.** The sheet is bytes headed
 * straight for the user's disk and nothing else -- it is never stored, never a
 * row, and never rendered. An action would have to base64 it through the RSC
 * payload to say the same thing, at a third again the size.
 *
 * Identity comes from the cookie and the ids are filtered by `user_id` in the
 * query that reads them, so a borrowed id composites nothing.
 */
export async function POST(request: Request) {
  const { userId } = await resolveAuth()

  let ids: unknown
  try {
    ids = (await request.json())?.ids
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === 'string' && UUID.test(id))
  ) {
    return new Response('Bad request', { status: 400 })
  }

  let sheet
  try {
    sheet = await buildReferenceSheet(userId, ids as Array<string>)
  } catch (err) {
    // The one failure worth a sentence is "too much image", which the caller
    // shows verbatim; everything else is a broken object or a dead bucket and
    // reads the same to whoever pressed the button.
    const message = err instanceof Error ? err.message : 'Could not build sheet'
    return new Response(message, { status: 422 })
  }

  return new Response(new Uint8Array(sheet.png), {
    headers: {
      'content-type': 'image/png',
      'content-length': String(sheet.png.byteLength),
      // The client reads the name from here rather than composing its own --
      // the cell count and the finished dimensions are the record of what was
      // tried, and only the server knows them.
      'content-disposition': `attachment; filename="${referenceSheetFileName(sheet)}"`,
      'cache-control': 'no-store',
    },
  })
}
