'use server'

import { isYouTubeId } from '../youtube'
import { youTubeFrame } from '../youtube-frame.server'
import type { YouTubeFrame } from '../youtube-frame.server'
import { resolveAuth } from '#/lib/server/auth.server'

/**
 * Pull one frame out of a YouTube video (#613).
 *
 * **Development-only, the way Lighting's Save is.** It shells out to `yt-dlp`,
 * a system binary the deploy does not have and would have to keep updated
 * against YouTube's changes -- which is the real cost, not the install. So it
 * refuses in production and says why, rather than the button quietly not being
 * there: a capability that silently does not exist is worse to run into than an
 * error naming the reason. That mirrors how the optional `ANTHROPIC_API_KEY`
 * behaves everywhere else in this app.
 *
 * **Nothing about the video is kept.** No clip row, no bucket object, no entry
 * on the Video wall -- the frame is an ordinary upload the moment the browser
 * saves it, and the link is gone with the session. That is the whole point:
 * grabbing a reference still should not enlarge the library by a video nobody
 * asked for.
 *
 * The id is re-checked here rather than trusted from the caller. It is the only
 * thing that reaches `yt-dlp`'s argument list, and eleven characters of
 * `[A-Za-z0-9_-]` cannot be a flag or another site.
 */
export async function grabYouTubeFrame({
  videoId,
  timeSeconds,
}: {
  videoId: string
  timeSeconds: number
}): Promise<YouTubeFrame> {
  await resolveAuth()

  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'Grabbing frames from YouTube needs yt-dlp, so it only works under `pnpm dev`.',
    )
  }

  if (!isYouTubeId(videoId)) throw new Error('That is not a YouTube video')
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new Error('That is not a position in the video')
  }

  return youTubeFrame(videoId, timeSeconds)
}
