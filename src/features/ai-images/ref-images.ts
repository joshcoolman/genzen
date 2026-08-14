import type { RefImage } from './hooks/use-generator'

/**
 * Put one image at the front of the reference strip.
 *
 * The opposite end from appending: this is the Cmd-Shift-click gesture, which
 * means "use this one", so it goes to slot 0 -- the slot the aspect ratio
 * follows and the submit sends first. An image already in the strip moves to
 * the front instead of duplicating: same intent, and the strip would otherwise
 * show it twice.
 *
 * It used to evict the last image past the selected model's capacity. Nothing
 * evicts since #341 -- the set is unbounded and each model takes what it holds
 * at submit -- and no limit was invented to replace it, because a strip-only
 * number would be a cap nobody asked for wearing a different name.
 */
export function pushRef(
  prev: Array<RefImage>,
  image: RefImage,
): Array<RefImage> {
  return [image, ...prev.filter((r) => r.id !== image.id)]
}
