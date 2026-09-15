/**
 * What these need off a clip, structurally rather than by naming the route's
 * `VideoRecord`. A feature module cannot import from `app/` -- the dependency
 * runs the other way -- and the four fields are the whole contract.
 */
export interface ClipShape {
  title: string
  generation_metadata: Record<string, unknown> | null
  /** The clip's rectangle, off frame one (#499). */
  width: number | null
  height: number | null
}

/**
 * A clip as the shared tiles draw it: `ClipShape` plus what a picture needs.
 *
 * `ClipPicker` and `ClipFrames` live in `src/components/` (#662), which cannot
 * name the route's `VideoRecord` any more than a feature can -- so they take
 * this and are generic over it, and a caller gets its own rows back out of the
 * picker rather than a narrowed copy.
 */
export interface ClipTile extends ClipShape {
  id: string
  description: string | null
  /** Whether the row points at a stored final frame (#512). */
  has_end_frame: boolean
}

/**
 * A clip's shape as a number, or null when nothing recorded it.
 *
 * Null is a real state and not a bug to route around: `width`/`height` come off
 * the decoded poster (#499), so a clip whose poster never decoded has no shape
 * on the row. Callers must decide what to do about that rather than get a
 * plausible default -- a wrong ratio silently lets a portrait clip into a
 * landscape run, which is the thing knowing the ratio was for.
 */
export function aspectRatio(
  clip: Pick<ClipShape, 'width' | 'height'>,
): number | null {
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

/**
 * A ratio snapped to the named shape it counts as, or left alone when it counts
 * as none.
 *
 * **For laying out, where the exact number is a liability.** The lineup returns
 * 1504x672 (2.238) and 1568x672 (2.333) for the same request; both are 21:9 by
 * `sameAspect`, both say "21:9" in a caption, and a stage sized from the raw
 * ratio then made one card ~14px shorter than the one beside it. Three parts of
 * the app calling them the same shape and a fourth disagreeing is the
 * contradiction, not the pixels.
 *
 * The cost is under the tolerance by definition -- at most 5% of the picture
 * cropped or matted, which is the same 5% the app already treats as no
 * difference at all.
 */
export function namedRatio(ratio: number | null): number | null {
  if (ratio == null) return null
  const named = NAMED.find(([, value]) => sameAspect(ratio, value))
  return named ? named[1] : ratio
}

/** A ratio as a person would say it, falling back to a decimal for the ones
 *  nothing in the lineup produces. */
export function aspectLabel(ratio: number | null): string | null {
  if (ratio == null) return null
  const named = NAMED.find(([, value]) => sameAspect(ratio, value))
  return named ? named[0] : `${ratio.toFixed(2)}:1`
}

/**
 * The model that made a clip.
 *
 * **`title` held this and no longer does.** A clip's row was titled with the
 * model label at submit and again at completion, and nothing else ever wrote
 * there -- so the label and the clip's name were one field, and a clip could
 * not be called "scene two". Naming takes `title` over; the label reads from
 * the copy that has sat beside it in `generation_metadata` since #367, pinned
 * at submit so cutting a model from the lineup does not rename its clips.
 *
 * `title` is the fallback, which is what makes this need no migration: every
 * row written before a clip could be named still holds the label there, and
 * one without the metadata copy reads exactly as it did.
 */
export function clipModel(clip: ClipShape): string {
  const label = (clip.generation_metadata ?? {}).model_label
  return typeof label === 'string' && label ? label : clip.title
}

/**
 * The name a person gave this clip, or null while it is still called after the
 * model that made it.
 *
 * Derived rather than stored, so there is no "has been renamed" flag to keep
 * true: a clip named back to its model's label is a clip with no name, which
 * is the same thing it looks like.
 */
export function clipName(clip: ClipShape): string | null {
  const model = clipModel(clip)
  return clip.title && clip.title !== model ? clip.title : null
}

/**
 * What a clip says about itself in one line: its name if it has one, the model,
 * how long it runs, and its shape.
 *
 * The duration is on `generation_metadata`, the same field the Video route's
 * card reads it from.
 *
 * The shape is here because clips of different shapes cannot cut together
 * (#512), so it is a fact about whether two of these belong in one run, not
 * decoration. Omitted rather than guessed when the row does not know it.
 */
export function clipFacts(clip: ClipShape): string {
  const seconds = (clip.generation_metadata ?? {}).duration_seconds
  const ratio = aspectLabel(aspectRatio(clip))
  return [
    clipName(clip),
    clipModel(clip),
    typeof seconds === 'number' ? `${seconds}s` : null,
    ratio,
  ]
    .filter(Boolean)
    .join(' · ')
}
