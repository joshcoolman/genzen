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

/**
 * The labels that tell a model which picture is which (#436).
 *
 * A generation sends one prompt string and one ordered array of images, with no
 * per-image field, so "image 2" can only ever be words in the prompt. This is
 * those words, prepended at submit: `[Image 1, Image 2]\n\n`.
 *
 * Pure and tested for the same reason `pushRef` is -- a prefix that disagrees
 * with the set it was built from is invisible. Nothing about it looks wrong; a
 * prompt naming image 2 just quietly gets image 3.
 *
 * Empty below two images: a lone "[Image 1]" is a number for a picture nothing
 * needs to distinguish from another.
 */
export function imageLabelPrefix(count: number): string {
  if (count < 2) return ''
  const labels = Array.from({ length: count }, (_, i) => `Image ${i + 1}`)
  return `[${labels.join(', ')}]\n\n`
}
