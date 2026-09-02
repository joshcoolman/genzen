'use client'

/** Give up rather than leave a clip on the track with no length forever. */
const TIMEOUT_MS = 15_000

/**
 * How long a clip actually runs, from its URL.
 *
 * A detached `<video>`, never added to the document -- the same approach
 * `captureLastFrame` takes, and for the same reason: nothing needs to be seen,
 * and appending one means a hidden player in the tree for the lifetime of the
 * call.
 *
 * **Every clip on the track needs this, not just the one being trimmed.** The
 * trim panel reads `duration` off the player it already has, which was enough
 * for the selected clip and wrong for all the others: their widths, the
 * timeline's total, and the out point sent to the export were all computed from
 * a length nobody had read. A clip you had not clicked contributed nothing and
 * exported as a zero-length segment.
 */
export function clipDuration(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('The clip took too long to report its length'))
    }, TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timer)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('error', onError)
      // Drop the download rather than waiting to be collected.
      video.removeAttribute('src')
      video.load()
    }
    function onMeta() {
      const { duration } = video
      cleanup()
      if (Number.isFinite(duration) && duration > 0) resolve(duration)
      else reject(new Error('The clip does not report a duration'))
    }
    function onError() {
      cleanup()
      reject(new Error('The clip could not be loaded'))
    }

    video.addEventListener('loadedmetadata', onMeta, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.src = src
  })
}
