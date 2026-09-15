import type { VideoRecord } from '../../video/_actions/generate-video.action'

/**
 * A run's prompts, verbatim, one after another.
 *
 * **No formatting beyond a blank line between clips, and no assumptions.**
 * The first cut of this pulled the quoted spans out of each prompt as the
 * spoken lines, and it was wrong about which parts mattered: the prompts that
 * make a run cut together are massaged by hand, and what is true of the whole
 * video, the music, the action, is in there deliberately. The words exactly as
 * they generated the clips are the honest baseline, and anything cleverer --
 * dropping the repeated setup, keeping quotes verbatim and summarising the
 * rest -- is a later pass over this text, not a replacement for it.
 *
 * A clip with no prompt (an upload) contributes an empty entry rather than
 * vanishing, so the count of paragraphs still matches the row.
 */
export function scriptOf(
  clips: Array<Pick<VideoRecord, 'description'>>,
): string {
  return clips.map((clip) => clip.description?.trim() ?? '').join('\n\n')
}
