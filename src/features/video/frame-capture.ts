/**
 * Pulling a still out of a clip, in the browser.
 *
 * There is no ffmpeg on the server and nothing there can decode video, so the
 * extraction has to happen where the frame is already decoded. `toBlob` is only
 * allowed because clips are served from `/img/[id]`, our own origin, so the
 * canvas is not tainted -- a clip served from FAL's URL would throw instead.
 * Both consumers today play from `/img/[id]`; anything reaching for these with
 * a provider URL will fail at `toBlob` and should not be given a flag to
 * silence it.
 *
 * Promoted out of `lab/frames/use-view.ts` when Video wanted the same thing
 * (#494). The lab may import from the app but the app may never import from the
 * lab, so a shared mechanism cannot live under `lab/` -- and a second consumer
 * is exactly what `src/features/` is for.
 */

/** A frame, as it comes off the canvas. */
export interface CapturedFrame {
  blob: Blob
  width: number
  height: number
}

/**
 * How far back from the stated duration the last frame is taken.
 *
 * Seeking to exactly `duration` commonly lands past the final sample and
 * decodes nothing -- a blank frame, or no `seeked` event at all. This is far
 * enough back to be inside the clip and short enough to be the same moment to
 * the eye. It is not a guess about keyframes: a browser may still snap the seek
 * to the nearest one, so the frame this returns is *near* the end rather than
 * provably the last one. For continuing a sequence that is the same thing;
 * for anything that needs the exact final sample, it is not.
 */
const END_EPSILON_SECONDS = 0.05

/** How long to wait on metadata or a seek before giving up. */
const READY_TIMEOUT_MS = 15_000

/**
 * Draw a `<video>` onto a canvas at its own pixel size.
 *
 * `videoWidth`/`videoHeight` *is* the clip's aspect, so "same aspect as the
 * video" needs no arithmetic. Captures whatever frame is showing -- the caller
 * decides which one that is.
 */
export function captureFrame(video: HTMLVideoElement): Promise<CapturedFrame> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) throw new Error('The clip has not loaded yet')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not get a 2d canvas context')
  context.drawImage(video, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve({ blob, width, height })
      else reject(new Error('Could not read the frame off the canvas'))
    }, 'image/png')
  })
}

function once(
  element: HTMLVideoElement,
  event: string,
  timeoutMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(timeoutMessage))
    }, READY_TIMEOUT_MS)

    const onDone = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('The clip could not be loaded'))
    }
    function cleanup() {
      clearTimeout(timer)
      element.removeEventListener(event, onDone)
      element.removeEventListener('error', onError)
    }

    element.addEventListener(event, onDone, { once: true })
    element.addEventListener('error', onError, { once: true })
  })
}

/**
 * The frame at the end of a clip, from its URL.
 *
 * Loads its own detached `<video>` rather than reading a mounted player, so the
 * playhead of whatever the user is watching is left where they put it. Nothing
 * is added to the document -- a detached element decodes perfectly well, and
 * appending one means a hidden player in the tree for the lifetime of the call.
 *
 * `timeSeconds` is where the seek actually landed, not where it was asked to
 * go, so a caller recording provenance records the truth.
 */
export async function captureLastFrame(
  src: string,
): Promise<CapturedFrame & { timeSeconds: number }> {
  const video = document.createElement('video')
  video.preload = 'auto'
  // Muted and inline so a browser treats loading it as cheap and uncontested;
  // it is never played and never seen.
  video.muted = true
  video.playsInline = true
  video.src = src

  try {
    await once(video, 'loadedmetadata', 'The clip took too long to load')

    const { duration } = video
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('The clip does not report a duration')
    }

    video.currentTime = Math.max(0, duration - END_EPSILON_SECONDS)
    await once(video, 'seeked', 'The clip took too long to seek')

    const frame = captureFrame(video)
    return { ...(await frame), timeSeconds: video.currentTime }
  } finally {
    // Drop the download on the floor. Without this the element holds its buffer
    // until it is collected, which on a 28MB clip is worth being explicit about.
    video.removeAttribute('src')
    video.load()
  }
}
