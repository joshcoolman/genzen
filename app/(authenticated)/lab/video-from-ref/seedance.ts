/**
 * The endpoint's constants and its arithmetic.
 *
 * Separate from `_actions/generate-ref-video.action.ts` because a `'use server'`
 * module may export nothing but async functions -- a constant beside the action
 * that uses it is a build error, not a type error, so nothing catches it until
 * the page is loaded.
 *
 * Local to this page, not an entry in `VIDEO_MODELS` (#462). That type is
 * `firstFrameParam` / `acceptsEndImage` / per-endpoint `aspectRatios`, none of
 * which describe an endpoint where nothing is pinned as a frame -- and its
 * `estimateCostCents` cannot express this one's billing at all.
 */

/**
 * **No `fal-ai/` prefix.** Almost everything in both lineups has one; this and
 * the Grok entries do not, so anything matching on the prefix misses it.
 */
export const ENDPOINT = 'bytedance/seedance-2.0/reference-to-video'

/** The endpoint's cap on `image_urls`. */
export const MAX_IMAGES = 9

/**
 * **Only 720p can be quoted before the press.** 480p, 1080p and 4k are billed
 * by token, so a price shown for them would be a guess -- which is why the tier
 * is pinned rather than offered.
 */
export const RESOLUTION = '720p'

/**
 * 720p with no video inputs, per FAL's rate card: $0.3024/second. Video inputs
 * are 40% cheaper per second and irrelevant here -- images only.
 */
const CENTS_PER_SECOND = 30.24

/** `duration` is a string enum on this endpoint, `auto` plus 4..15. */
export const DURATIONS = ['4', '6', '8', '10', '12', '15'] as const

/**
 * Default 4, not `auto`.
 *
 * `auto` lets the model pick 4 to 15 seconds, a 2.5x cost range, which makes
 * the number above the button a guess. Four is the floor and the right default
 * for a page whose job is a handful of exploratory presses.
 */
export const DEFAULT_DURATION = '4'

/** 16:9 by default -- the shape these references were cut from. */
export const DEFAULT_ASPECT_RATIO = '16:9'

export function estimateCostCents(duration: string): number {
  return Math.round(Number(duration) * CENTS_PER_SECOND)
}
