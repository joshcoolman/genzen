import type { VideoRecord } from '../../video/_actions/generate-video.action'

/**
 * What the page is pulling frames out of.
 *
 * Two kinds, because the pixels come from two places: a clip is our own object
 * on our own origin, so the browser decodes it and the canvas takes the frame;
 * a YouTube video is a cross-origin iframe that will never give up a pixel, so
 * the browser supplies the timestamp and the server supplies the frame.
 *
 * The rest of the page is written against this rather than against either one
 * -- the grid, the trash button and the provenance stamp do not care which half
 * a frame came from, and a frame cut from a reference video sitting beside one
 * cut from a generated clip is most of what the grid is for.
 */
export type FrameSource =
  | { kind: 'clip'; clip: VideoRecord }
  | { kind: 'youtube'; videoId: string; title: string }

/** A YouTube video as the page holds it: the id, and the best title known so
 *  far. The player reports the real one when it is ready. */
export interface YouTubeSource {
  videoId: string
  title: string
}

/** What to call the source in a frame's caption. */
export function sourceTitle(source: FrameSource): string {
  return source.kind === 'clip' ? source.clip.title : source.title
}
