import type { VideoRecord } from '../../../video/_actions/generate-video.action'

/**
 * What a clip says about itself in one line: the model, and how long it runs.
 *
 * The duration is on `generation_metadata`, the same field the Video route's
 * card reads it from. `title` is the model name -- that is what the video
 * pipeline puts there, and it is why a picker full of clips is readable at all.
 */
export function clipFacts(clip: VideoRecord): string {
  const seconds = (clip.generation_metadata ?? {}).duration_seconds
  return typeof seconds === 'number'
    ? `${clip.title} · ${seconds}s`
    : clip.title
}
