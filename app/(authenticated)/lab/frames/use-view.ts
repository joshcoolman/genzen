'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { grabYouTubeFrame } from './_actions/grab-youtube-frame.action'
import type { YouTubePlayer } from './_components/youtube-stage/youtube-stage'
import type { FrameSource, YouTubeSource } from './source'
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

/** And the YouTube video, for the same reason. Its own key rather than one
 *  union under the old one: the old key already holds an array of clip ids on
 *  three machines, and a second key costs nothing next to a migration. */
const YOUTUBE_KEY = 'genzen:lab:frames:youtube'

/**
 * A frame, from the click that asked for it to the row it becomes.
 *
 * It appears in the grid at the moment of the click and fills in later, which
 * is why almost everything here is nullable. `key` is what the page identifies
 * it by throughout; `id` is the `user_images` row and only exists once the save
 * has landed -- after that it is an ordinary upload like any other.
 */
export interface ExtractedFrame {
  key: string
  id: string | null
  url: string | null
  clipTitle: string
  timeSeconds: number
  width: number | null
  height: number | null
  /** Set when this one failed. The tile stays, because a click that produced
   *  nothing and left no trace is indistinguishable from a click that missed. */
  error?: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** PNG bytes from the server, as the `File` the library takes. */
function fileFromBase64(base64: string, name: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: 'image/png' })
}

/**
 * The grid is this session's extractions, not a query.
 *
 * A frame is an ordinary upload the moment it is saved, so it is already in
 * Images and there is nothing here that a reload would lose except the run
 * itself -- which is the same bargain every other lab page makes. Persisting it
 * would mean a way to ask for "frames", which means a marker the library query
 * knows about, which is the schema this folder is not allowed to grow.
 *
 * **Two sources, one slot** (#613). A clip or a pasted YouTube video, never
 * both -- picking either clears the other, because "which video am I pulling
 * frames out of" has one answer. What differs between them is only where the
 * pixels come from: a clip is decoded in the browser and captured off a canvas,
 * a YouTube video is a cross-origin iframe that gives up its position and
 * nothing else, so the server seeks the same source and sends the frame back.
 * Everything after that -- the library row, the stamp, the grid, the trash --
 * is the same code.
 *
 * **The click never waits.** How this page is actually used is: let the video
 * play, and hit the button whenever something goes past that looks close to
 * what you are after. That is a rhythm of clicks a second apart, and it only
 * works if a click costs nothing -- so the click does the one thing that cannot
 * be deferred (read the position, or draw the running video to a canvas) and
 * hands the rest to a queue. A tile appears immediately and fills in when its
 * turn comes.
 *
 * **The queue is serial on purpose.** Ten clicks should not become ten ffmpeg
 * processes range-requesting the same remote stream at once; they would finish
 * later than one at a time and could get the whole session throttled. Order is
 * click order, which is also the order the tiles are already in.
 */
export function useView(clips: Array<VideoRecord>) {
  const { user } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)

  /* An array, and the picker is written for more than one, though only one can
     be picked today. Several clips at once -- stitching, comparing -- is the
     obvious next question and this should not be the thing standing in its way.

     **Remembered across visits.** The ids are what is stored, not the rows: a
     row goes stale and a clip can be trashed between visits, so what comes back
     is filtered against the clips that still exist. Coming back to this page to
     an empty stage is a picker dialog in the way of every session, for a choice
     that had already been made. */
  const [pickedIds, setPickedIds, hydrated] = usePersistedState<Array<string>>(
    () => read<Array<string>>(PICKED_KEY, []),
    [],
  )

  const [youtube, setYoutube] = usePersistedState<YouTubeSource | null>(
    () => read<YouTubeSource | null>(YOUTUBE_KEY, null),
    null,
  )

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(PICKED_KEY, JSON.stringify(pickedIds))
    localStorage.setItem(YOUTUBE_KEY, JSON.stringify(youtube))
  }, [hydrated, pickedIds, youtube])

  const picked = pickedIds
    .map((id) => clips.find((c) => c.id === id))
    .filter((c): c is VideoRecord => !!c)
  const [frames, setFrames] = useState<Array<ExtractedFrame>>([])
  const [queued, setQueued] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clip = picked.at(0) ?? null

  /* YouTube wins when it is set, and setting one clears the clips -- so this
     can never be ambiguous about which of the two is on screen. */
  const source: FrameSource | null = youtube
    ? { kind: 'youtube', ...youtube }
    : clip
      ? { kind: 'clip', clip }
      : null

  /** The tail of the queue. A promise chain rather than a worker: the work is
   *  already asynchronous and there is only ever one lane. */
  const tail = useRef<Promise<void>>(Promise.resolve())

  const enqueue = useCallback((task: () => Promise<void>) => {
    setQueued((n) => n + 1)
    tail.current = tail.current
      .then(task)
      .catch(() => {})
      .finally(() => setQueued((n) => n - 1))
  }, [])

  /** The library row, the provenance stamp and the finished tile -- the half of
   *  an extraction that is the same whichever source the pixels came from. */
  const keep = useCallback(
    async ({
      key,
      file,
      width,
      height,
      timeSeconds,
      title,
      description,
      clipId,
      youtubeId,
    }: {
      key: string
      file: File
      width: number
      height: number
      timeSeconds: number
      title: string
      description?: string | null
      clipId?: string
      youtubeId?: string
    }) => {
      const image = await saveFileToLibrary({
        userId: user.id,
        file,
        title: `Frame · ${title}`,
        description: description ?? null,
      })

      // Best-effort: a frame without its origin stamped is still a usable
      // image, so a failure here must not lose the extraction.
      void stampFrameSource({
        imageId: image.id,
        clipId: clipId ?? null,
        youtubeId: youtubeId ?? null,
        timeSeconds,
        kind: 'scrub',
      }).catch(() => {})

      setFrames((current) =>
        current.map((f) =>
          f.key === key
            ? { ...f, id: image.id, url: imageUrl(image.id), width, height }
            : f,
        ),
      )
    },
    [user.id],
  )

  /** Mark one tile as having failed, in place. */
  const fail = useCallback((key: string, err: unknown) => {
    const message =
      err instanceof Error ? err.message : 'Could not extract a frame'
    setFrames((current) =>
      current.map((f) => (f.key === key ? { ...f, error: message } : f)),
    )
    setError(message)
  }, [])

  /**
   * Ask for the frame that is on screen right now.
   *
   * Synchronous by design -- it returns before any network happens, so clicks
   * can come as fast as they come. Everything it captures is captured *before*
   * the queue is touched, because by the time the queue gets there the video
   * has moved on.
   */
  const extract = useCallback(() => {
    if (!source) return

    const key = crypto.randomUUID()
    setError(null)

    if (source.kind === 'clip') {
      const video = videoRef.current
      if (!video) return

      const timeSeconds = video.currentTime
      const { clip: from } = source

      let captured
      try {
        // Drawn now, off the frame that is showing. Deferring this to the queue
        // would capture whatever the player had reached by then.
        captured = captureFrame(video)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not extract a frame',
        )
        return
      }

      setFrames((current) => [
        {
          key,
          id: null,
          url: null,
          clipTitle: from.title,
          timeSeconds,
          width: null,
          height: null,
        },
        ...current,
      ])

      enqueue(async () => {
        try {
          const { blob, width, height } = await captured
          await keep({
            key,
            file: new File(
              [blob],
              `frame-${from.id}-${timeSeconds.toFixed(2)}.png`,
              { type: 'image/png' },
            ),
            width,
            height,
            timeSeconds,
            title: from.title,
            description: from.description,
            clipId: from.id,
          })
        } catch (err) {
          fail(key, err)
        }
      })
      return
    }

    const player = playerRef.current
    if (!player) {
      setError('The player has not loaded yet')
      return
    }

    // Read now: the video keeps playing while the queue works, and a position
    // read at the front of the queue would be seconds late.
    const timeSeconds = player.getCurrentTime()
    const { videoId, title } = source

    setFrames((current) => [
      {
        key,
        id: null,
        url: null,
        clipTitle: title,
        timeSeconds,
        width: null,
        height: null,
      },
      ...current,
    ])

    enqueue(async () => {
      try {
        const { base64, width, height } = await grabYouTubeFrame({
          videoId,
          timeSeconds,
        })
        await keep({
          key,
          file: fileFromBase64(
            base64,
            `frame-${videoId}-${timeSeconds.toFixed(2)}.png`,
          ),
          width,
          height,
          timeSeconds,
          title,
          description: `youtube.com/watch?v=${videoId} at ${timeSeconds.toFixed(2)}s`,
          youtubeId: videoId,
        })
      } catch (err) {
        fail(key, err)
      }
    })
  }, [enqueue, fail, keep, source])

  /* Trash, never destroy. Both verbs here go through the gallery's own delete,
     so a wrong click is a trip to Trash and nothing on this page reaches
     outside it irreversibly. */
  const removeFrame = useCallback(async (frame: ExtractedFrame) => {
    setError(null)
    // One that never landed has no row to trash -- dropping the tile is the
    // whole of it.
    if (!frame.id) {
      setFrames((current) => current.filter((f) => f.key !== frame.key))
      return
    }
    setBusyId(frame.id)
    try {
      await deleteGalleryImage(frame.id)
      setFrames((current) => current.filter((f) => f.key !== frame.key))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not trash the frame')
    } finally {
      setBusyId(null)
    }
  }, [])

  const clearFrames = useCallback(async () => {
    setError(null)
    try {
      await Promise.all(
        frames
          .map((f) => f.id)
          .filter((id): id is string => !!id)
          .map((id) => deleteGalleryImage(id)),
      )
      setFrames([])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not trash the frames',
      )
    }
  }, [frames])

  return {
    clips,
    source,
    picked,
    youtube,
    pickClips: useCallback(
      (next: Array<VideoRecord>) => {
        setPickedIds(next.map((c) => c.id))
        setYoutube(null)
      },
      [setPickedIds, setYoutube],
    ),
    pickYoutube: useCallback(
      (videoId: string) => {
        // The id stands in until the player reports the real title, which is a
        // second away and needs no request of our own.
        setYoutube({ videoId, title: videoId })
        setPickedIds([])
        setError(null)
      },
      [setPickedIds, setYoutube],
    ),
    /** The player knows the real title once it is ready. */
    nameYoutube: useCallback(
      (title: string) =>
        setYoutube((current) => (current ? { ...current, title } : current)),
      [setYoutube],
    ),
    removeClip: useCallback(
      (id: string) =>
        setPickedIds((current) => current.filter((c) => c !== id)),
      [setPickedIds],
    ),
    videoRef,
    playerRef,
    frames,
    /** How many clicks are still waiting on the queue. */
    queued,
    busyId,
    error,
    setError,
    extract,
    removeFrame,
    clearFrames,
  }
}
