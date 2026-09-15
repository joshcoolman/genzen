import type { VideoRecord } from '../../video/_actions/generate-video.action'

/**
 * A clip the run is holding a place for, which FAL has not finished (#660).
 *
 * The row shows one and the player cannot, which is the whole reason the two
 * are indexed apart -- everything in this file exists to keep an off-by-one
 * from creeping in between them.
 */
export const isPending = (clip: Pick<VideoRecord, 'status'>) =>
  clip.status !== 'completed'

/** The run as the player can play it: the finished clips, in run order. */
export function playableClips(picked: Array<VideoRecord>): Array<VideoRecord> {
  return picked.filter((clip) => !isPending(clip))
}

/**
 * A position in the row, as a position in the player.
 *
 * -1 for a clip the player does not have -- a pending one, or an index off the
 * end -- so a caller can refuse the jump rather than land somewhere arbitrary.
 */
export function toPlayableIndex(
  picked: Array<VideoRecord>,
  rowIndex: number,
): number {
  const clip = picked.at(rowIndex)
  // `at` takes a negative index from the end, which is never what a row
  // position means.
  if (!clip || rowIndex < 0 || isPending(clip)) return -1
  return playableClips(picked).findIndex((c) => c.id === clip.id)
}

/** And back, so the row can light the tile the player is on. */
export function toRowIndex(
  picked: Array<VideoRecord>,
  playableIndex: number | null,
): number | null {
  if (playableIndex === null || playableIndex < 0) return null
  const clip = playableClips(picked).at(playableIndex)
  if (!clip) return null
  const index = picked.findIndex((c) => c.id === clip.id)
  return index < 0 ? null : index
}
