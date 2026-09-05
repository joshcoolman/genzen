import { clipResult, readReceipt } from '../clip-jobs.server'
import { sameOrigin } from '../request-origin'
import { resolveAuth } from '#/lib/server/auth.server'
import { falFetch } from '#/lib/server/fal-fetch.server'

/** Fetch only a verified job's provider result, never a caller-supplied URL.
 * Same-origin bytes can be persisted and used in a canvas without CORS. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 })
  let owner: string
  try {
    owner = (await resolveAuth()).userId
  } catch {
    return new Response(null, { status: 401 })
  }
  try {
    const { token } = await request.json()
    const receipt = readReceipt(token, owner)
    const url = await clipResult(receipt)
    const response = await falFetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) throw new Error('Media download failed.')
    const blob = await response.blob()
    if (!blob.size || blob.size > 100 * 1024 * 1024)
      throw new Error('Unexpected clip size.')
    return new Response(blob, {
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return Response.json(
      {
        error:
          'Could not retrieve this clip. Check the existing request again; no new generation is needed.',
      },
      { status: 502 },
    )
  }
}
