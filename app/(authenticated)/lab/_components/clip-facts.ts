import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { clipDurationSeconds } from '#/features/video/models'

/**
 * What a clip says about itself in one line: the model, and how long it runs.
 *
 * The duration is on `generation_metadata`, the same field the Video route's
 * card reads it from -- `measured_duration_seconds`, read off the file by
 * ffprobe at ingest, in preference to `duration_seconds`, which is what was
 * asked for at submit time (#499). They disagree in practice: `models.ts` notes
 * MiniMax billing on 1.2x the requested duration. Clips made before that
 * existed have only the requested figure. `title` is the model name -- that is
 * what the video pipeline puts there, and it is why a picker full of clips is
 * readable at all.
 */
export function clipFacts(clip: VideoRecord): string {
  const seconds = clipDurationSeconds(clip)
  return seconds != null ? `${clip.title} · ${seconds}s` : clip.title
}
