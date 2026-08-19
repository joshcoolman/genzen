'use client'

import { useCallback, useRef, useState } from 'react'
import { stampFrameSource } from './_actions/stamp-frame.action'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { deleteGalleryImage } from '#/features/ai-images/server/gallery.action'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'

/** A frame pulled out of a clip, as this page knows it. */
export interface ExtractedFrame {
  /** The `user_images` row -- it is an ordinary upload from here on. */
  id: string
  url: string
  clipTitle: string
  timeSeconds: number
  width: number
  height: number
}

/**
 * The capture itself: draw the `<video>` onto a canvas at its own pixel size.
 *
 * There is no ffmpeg on the server and nothing there can decode video, so the
 * extraction has to happen where the frame is already decoded -- in the
 * browser. `toBlob` is only allowed because the clip comes from `/img/[id]`,
 * our own origin, so the canvas is not tainted; a clip served from FAL's URL
 * would throw here instead.
 *
 * `videoWidth`/`videoHeight` *is* the clip's aspect, so "same aspect as the
 * video" needs no arithmetic.
 */
function captureFrame(video: HTMLVideoElement): Promise<{
  blob: Blob
  width: number
  height: number
}> {
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

/**
 * The grid is this session's extractions, not a query.
 *
 * A frame is an ordinary upload the moment it is saved, so it is already in
 * Images and there is nothing here that a reload would lose except the run
 * itself -- which is the same bargain every other lab page makes. Persisting it
 * would mean a way to ask for "frames", which means a marker the library query
 * knows about, which is the schema this folder is not allowed to grow.
 */
export function useView(clips: Array<VideoRecord>) {
  const { user } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [clipId, setClipId] = useState<string | null>(clips.at(0)?.id ?? null)
  const [frames, setFrames] = useState<Array<ExtractedFrame>>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clip = clips.find((c) => c.id === clipId) ?? null

  const extract = useCallback(async () => {
    const video = videoRef.current
    if (!video || !clip) return

    setIsExtracting(true)
    setError(null)
    try {
      const timeSeconds = video.currentTime
      const { blob, width, height } = await captureFrame(video)

      const image = await saveFileToLibrary({
        userId: user.id,
        file: new File(
          [blob],
          `frame-${clip.id}-${timeSeconds.toFixed(2)}.png`,
          {
            type: 'image/png',
          },
        ),
        title: `Frame · ${clip.title}`,
        description: clip.description,
      })

      // Best-effort: a frame without its origin stamped is still a usable
      // image, so a failure here must not lose the extraction.
      void stampFrameSource({
        imageId: image.id,
        clipId: clip.id,
        timeSeconds,
      }).catch(() => {})

      setFrames((current) => [
        {
          id: image.id,
          url: imageUrl(image.id),
          clipTitle: clip.title,
          timeSeconds,
          width,
          height,
        },
        ...current,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract a frame')
    } finally {
      setIsExtracting(false)
    }
  }, [clip, user.id])

  /* Trash, never destroy. Both verbs here go through the gallery's own delete,
     so a wrong click is a trip to Trash and nothing on this page reaches
     outside it irreversibly. */
  const removeFrame = useCallback(async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      await deleteGalleryImage(id)
      setFrames((current) => current.filter((f) => f.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not trash the frame')
    } finally {
      setBusyId(null)
    }
  }, [])

  const clearFrames = useCallback(async () => {
    setError(null)
    try {
      await Promise.all(frames.map((f) => deleteGalleryImage(f.id)))
      setFrames([])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not trash the frames',
      )
    }
  }, [frames])

  return {
    clips,
    clip,
    selectClip: setClipId,
    videoRef,
    frames,
    isExtracting,
    busyId,
    error,
    extract,
    removeFrame,
    clearFrames,
  }
}
