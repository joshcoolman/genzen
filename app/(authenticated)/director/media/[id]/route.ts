import { idSchema } from '../../_lib/types'
import { readMedia } from '../../_lib/media.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { parseRange } from '#/lib/http-range'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await resolveAuth()
  const { id } = await params
  if (!idSchema.safeParse(id).success)
    return new Response(null, { status: 404 })
  try {
    const blob = await readMedia(userId, id)
    const range = parseRange(request.headers.get('range'), blob.size)
    const headers = {
      'Content-Type': blob.type,
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
    }
    if (range)
      return new Response(blob.slice(range.start, range.end + 1), {
        status: 206,
        headers: {
          ...headers,
          'Content-Range': `bytes ${range.start}-${range.end}/${blob.size}`,
          'Content-Length': String(range.end - range.start + 1),
        },
      })
    return new Response(blob, {
      headers: { ...headers, 'Content-Length': String(blob.size) },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
