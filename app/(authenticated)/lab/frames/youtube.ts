/**
 * Reading a YouTube link, on either side of the wire.
 *
 * Deliberately not a `.server.ts` or an `.action.ts`: the browser needs it to
 * build the embed and the server needs it to know what to hand `yt-dlp`, and
 * those two have to agree on what a link means or the frame comes back from a
 * different video than the one on screen.
 *
 * **The id is the only thing that crosses.** Nothing sends the pasted string to
 * the server -- an arbitrary string reaching a subprocess argument list is a
 * class of problem worth not having, even where the list is `execFile`'s and
 * never a shell's. Eleven characters of `[A-Za-z0-9_-]` cannot be a flag, a
 * path, or another site.
 */

/** Every YouTube id is eleven of these, and has been for the life of the site. */
const ID = /^[A-Za-z0-9_-]{11}$/

/** The paths a video id shows up in. `watch` carries it in the query instead. */
const PATH_PREFIXES = ['/shorts/', '/embed/', '/live/', '/v/']

/**
 * The video id in `input`, or null if there is not one.
 *
 * Takes the forms a person actually pastes -- a watch URL with whatever
 * tracking parameters came with it, a `youtu.be` short link, a Shorts or live
 * URL, or the bare id -- and rejects everything else rather than guessing. A
 * playlist URL with no `v=` is not a video and comes back null.
 */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (ID.test(trimmed)) return trimmed

  let url: URL
  try {
    // A pasted link often has no scheme. Assuming https is safe because the
    // host is checked below either way.
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    )
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const isYouTube =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1)
    return ID.test(id) ? id : null
  }

  if (!isYouTube) return null

  const v = url.searchParams.get('v')
  if (v && ID.test(v)) return v

  for (const prefix of PATH_PREFIXES) {
    if (url.pathname.startsWith(prefix)) {
      const id = url.pathname.slice(prefix.length).split('/')[0] ?? ''
      return ID.test(id) ? id : null
    }
  }

  return null
}

/** Whether `id` is shaped like a video id -- the server's own check, so a
 *  hand-made action call cannot put anything else on `yt-dlp`'s argument list. */
export function isYouTubeId(id: string): boolean {
  return ID.test(id)
}

/** The tile picture, free and without an API key. `mqdefault` exists for every
 *  video; `maxresdefault` does not and 404s into a broken image. */
export function youTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}
