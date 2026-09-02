'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { deleteGalleryImage } from '#/features/ai-images/server/gallery.action'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { captureFrame } from '#/features/video/frame-capture'
import { stampFrameSource } from '#/features/video/server/stamp-frame.action'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { usePersistedState } from '#/lib/use-persisted-state'

/** Which clip you were working on, so the next visit opens where you left it. */
const PICKED_KEY = 'genzen:lab:frames:clips'

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

  /* An array, and the picker is written for more than one, though only one can
     be picked today. Several clips at once -- stitching, comparing -- is the
     obvious next question and this should not be the thing standing in its way.

     **Remembered across visits.** The ids are what is stored, not the rows: a
     row goes stale and a clip can be trashed between visits, so what comes back
     is filtered against the clips that still exist. Coming back to this page to
     an empty stage is a picker dialog in the way of every session, for a choice
     that had already been made. */
  const [pickedIds, setPickedIds, hydrated] = usePersistedState<
    Array<string>
  >(() => {
    try {
      const raw = localStorage.getItem(PICKED_KEY)
      return raw ? (JSON.parse(raw) as Array<string>) : []
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(PICKED_KEY, JSON.stringify(pickedIds))
  }, [hydrated, pickedIds])

  const picked = pickedIds
    .map((id) => clips.find((c) => c.id === id))
    .filter((c): c is VideoRecord => !!c)
  const [frames, setFrames] = useState<Array<ExtractedFrame>>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clip = picked.at(0) ?? null

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
        kind: 'scrub',
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
    picked,
    pickClips: useCallback(
      (next: Array<VideoRecord>) => setPickedIds(next.map((c) => c.id)),
      [setPickedIds],
    ),
    removeClip: useCallback(
      (id: string) =>
        setPickedIds((current) => current.filter((c) => c !== id)),
      [setPickedIds],
    ),
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
