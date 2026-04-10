import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  setResponseHeaders,
  setResponseStatus,
} from 'h3'

/**
 * CORS-enabled streaming proxy for FAL video URLs.
 *
 * The VideoFramePickerDialog on the client needs to load a FAL video into
 * a <video> element with crossOrigin="anonymous" so canvas.toDataURL() can
 * read the pixels without tainting. FAL's CDN doesn't send the headers the
 * browser needs for that, so we re-serve the bytes through Nitro with the
 * right headers.
 *
 * Only used by the thumbnail picker -- normal video playback still hits
 * FAL directly, so this adds bandwidth only when a user opens the picker.
 *
 * Preserves byte-range requests (critical for scrubbing) by forwarding the
 * Range header upstream and returning 206 Partial Content when appropriate.
 */

// Only allow proxying from known video hosts so the route can't be abused
// as an open proxy.
const ALLOWED_HOSTS = [
  'fal.media',
  'v3.fal.media',
  'fal-cdn.batuhan-941.workers.dev',
  'cdn.fal.media',
  'v2.fal.media',
  'fal.run',
]

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return ALLOWED_HOSTS.some(
      (host) =>
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    )
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = typeof query.url === 'string' ? query.url : null

  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'Missing url param' })
  }

  if (!isAllowedUrl(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL host not allowed',
    })
  }

  // Forward the Range header so the browser can scrub
  const rangeHeader = getHeader(event, 'range')
  const upstreamHeaders: Record<string, string> = {}
  if (rangeHeader) upstreamHeaders.range = rangeHeader

  let upstream: Response
  try {
    upstream = await fetch(url, { headers: upstreamHeaders })
  } catch (err) {
    console.error('[video-proxy] upstream fetch failed', err)
    throw createError({ statusCode: 502, statusMessage: 'Bad gateway' })
  }

  if (!upstream.ok && upstream.status !== 206) {
    setResponseStatus(event, upstream.status)
    return ''
  }

  // Mirror the relevant upstream headers and add CORS
  const responseHeaders: Record<string, string> = {
    'content-type': upstream.headers.get('content-type') ?? 'video/mp4',
    'accept-ranges': 'bytes',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=300',
  }

  const contentLength = upstream.headers.get('content-length')
  if (contentLength) responseHeaders['content-length'] = contentLength

  const contentRange = upstream.headers.get('content-range')
  if (contentRange) responseHeaders['content-range'] = contentRange

  setResponseHeaders(event, responseHeaders)
  setResponseStatus(event, upstream.status)

  return upstream.body
})
