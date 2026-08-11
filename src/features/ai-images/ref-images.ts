import type { RefImage } from './hooks/use-generator'

/**
 * Put one image at the front of the reference strip, evicting the last when it
 * is full.
 *
 * The opposite end from appending: this is the Cmd-Shift-click gesture, which
 * means "use this one", so a full strip must make room rather than refuse. An
 * image already in the strip moves to the front instead of duplicating -- same
 * intent, and the strip would otherwise show it twice.
 *
 * Returns `prev` unchanged when the model takes no references; the caller says
 * so out loud rather than letting the gesture do nothing (#213).
 */
export function pushRef(
  prev: Array<RefImage>,
  image: RefImage,
  max: number,
): Array<RefImage> {
  if (max <= 0) return prev
  return [image, ...prev.filter((r) => r.id !== image.id)].slice(0, max)
}
