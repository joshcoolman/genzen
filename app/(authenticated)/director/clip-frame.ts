/** Decode local bytes, never seek the playback element. MediaRecorder WebM may
 * omit duration; seeking beyond the end asks the browser to discover it. This
 * is browser-frame precision, not a frame-exact master extraction. */
export async function clipFrame(
  blob: Blob,
): Promise<{ endFrame: Blob; duration: number }> {
  const video = document.createElement('video')
  const url = URL.createObjectURL(blob)
  video.muted = true
  video.preload = 'auto'
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          finish(
            new Error(
              'Could not read this clip’s ending frame. The original recording is preserved.',
            ),
          ),
        20000,
      )
      function finish(error?: Error) {
        clearTimeout(timeout)
        video.onloadedmetadata = video.onseeked = video.onerror = null
        if (error) reject(error)
        else resolve()
      }
      let discovering = false
      video.onerror = () =>
        finish(
          new Error(
            'This recording cannot be decoded. Download the original before clearing it.',
          ),
        )
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration)) {
          discovering = true
          video.currentTime = 1e10
        } else video.currentTime = Math.max(0.001, video.duration - 1 / 24)
      }
      video.onseeked = () => {
        if (discovering) {
          discovering = false
          if (!Number.isFinite(video.duration) || video.duration <= 0) {
            finish(new Error('Could not determine this recording’s duration.'))
            return
          }
          video.currentTime = Math.max(0.001, video.duration - 1 / 24)
        } else finish()
      }
      video.src = url
    })
    if (
      !video.videoWidth ||
      !video.videoHeight ||
      !Number.isFinite(video.duration)
    )
      throw new Error('This clip has no usable video frame.')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('Frame capture is unavailable in this browser.')
    context.drawImage(video, 0, 0)
    const endFrame = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (frame) =>
          frame ? resolve(frame) : reject(new Error('Frame capture failed.')),
        'image/png',
      )
    })
    return { endFrame, duration: video.duration }
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
