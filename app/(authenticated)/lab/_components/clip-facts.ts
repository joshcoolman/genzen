import type { VideoRecord } from '../../video/_actions/generate-video.action'

/**
 * A clip's shape as a number, or null when nothing recorded it.
 *
 * Null is a real state and not a bug to route around: `width`/`height` come off
 * the decoded poster (#499), so a clip whose poster never decoded has no shape
 * on the row. Callers must decide what to do about that rather than get a
 * plausible default -- a wrong ratio silently lets a portrait clip into a
 * landscape run, which is the thing knowing the ratio was for.
 */
export function aspectRatio(clip: VideoRecord): number | null {
  if (!clip.width || !clip.height) return null
  return clip.width / clip.height
}

/**
 * How far apart two ratios may be and still count as one shape.
 *
 * **5%, and the number comes from the library rather than from taste.** Asked
 * for 16:9, the lineup returns both 1280x720 (1.778) and 1280x704 (1.818) --
 * 2.2% apart. Asked for 21:9 it returns 1440x608, 1568x672 and 1536x672, which
 * spread 2.286 to 2.368. Those are the same shape by intent and cut together
 * fine; a tighter tolerance splits each family in two and the filter starts
 * hiding clips that plainly belong. 2% was the first guess and did exactly that.
 *
 * The nearest thing it must *not* merge is 4:3 against 5:4, 6.7% apart, so
 * there is room above and the shapes people actually distinguish stay distinct.
 */
const TOLERANCE = 0.05

/**
 * Two clips are the same shape.
 *
 * A tolerance rather than equality, for the reason above. Unknown shapes never
 * match anything, including each other.
 */
export function sameAspect(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false
  return Math.abs(a - b) / b < TOLERANCE
}

/** The common ratios by name, so a filter can say "16:9" rather than "1.78". */
const NAMED: Array<[string, number]> = [
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['21:9', 21 / 9],
  ['4:5', 4 / 5],
  ['5:4', 5 / 4],
  ['2:3', 2 / 3],
  ['3:2', 3 / 2],
]

/** A ratio as a person would say it, falling back to a decimal for the ones
 *  nothing in the lineup produces. */
export function aspectLabel(ratio: number | null): string | null {
  if (ratio == null) return null
  const named = NAMED.find(([, value]) => sameAspect(ratio, value))
  return named ? named[0] : `${ratio.toFixed(2)}:1`
}

/**
 * What a clip says about itself in one line: the model, how long it runs, and
 * its shape.
 *
 * The duration is on `generation_metadata`, the same field the Video route's
 * card reads it from. `title` is the model name -- that is what the video
 * pipeline puts there, and it is why a picker full of clips is readable at all.
 *
 * The shape is here because clips of different shapes cannot cut together
 * (#512), so it is a fact about whether two of these belong in one run, not
 * decoration. Omitted rather than guessed when the row does not know it.
 */
export function clipFacts(clip: VideoRecord): string {
  const seconds = (clip.generation_metadata ?? {}).duration_seconds
  const ratio = aspectLabel(aspectRatio(clip))
  return [clip.title, typeof seconds === 'number' ? `${seconds}s` : null, ratio]
    .filter(Boolean)
    .join(' · ')
}
