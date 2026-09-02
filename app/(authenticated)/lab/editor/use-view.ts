'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exportTimeline } from './_actions/export-timeline.action'
import { clipDuration } from './clip-duration'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { imageUrl } from '#/lib/image-url'

/**
 * A clip on the track.
 *
 * `key` rather than the clip's id, because the same clip may sit on the track
 * more than once -- cutting back to a shot is an ordinary thing to want, and
 * keying by id would make the second copy share the first one's in and out
 * points.
 */
export interface TrackClip {
  key: string
  clip: VideoRecord
  /**
   * How long the file actually runs, read off the loaded `<video>`.
   *
   * Not `generation_metadata.duration_seconds`: that is what was *asked for* at
   * submit time and the repo already knows the two can disagree -- MiniMax
   * bills on 1.2x the requested duration. An editor that trusted the request
   * would put its out point past the end of the file.
   *
   * Null until the browser has read the metadata.
   */
  duration: number | null
  inSeconds: number
  /** Null means "to the end", which is what a clip starts as. */
  outSeconds: number | null
}

export interface ExportedEdit {
  id: string
  title: string
  durationSeconds: number
}

/** What one clip contributes to the finished cut. */
export function trimmedLength(t: TrackClip): number {
  const end = t.outSeconds ?? t.duration
  if (end == null) return 0
  return Math.max(0, end - t.inSeconds)
}

export function useView(clips: Array<VideoRecord>) {
  const [track, setTrack] = useState<Array<TrackClip>>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [transition, setTransition] = useState(0)
  const [title, setTitle] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exported, setExported] = useState<ExportedEdit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const add = useCallback((picked: Array<VideoRecord>) => {
    setTrack((current) => {
      const added = picked.map((clip) => ({
        key: `${clip.id}-${crypto.randomUUID()}`,
        clip,
        duration: null,
        inSeconds: 0,
        outSeconds: null,
      }))
      // Selecting what you just added is the next thing you want: the reason
      // to add a clip is to trim it.
      if (added.length > 0) setSelectedKey(added[0].key)
      return [...current, ...added]
    })
  }, [])

  const update = useCallback(
    (key: string, patch: Partial<Omit<TrackClip, 'key' | 'clip'>>) => {
      setTrack((current) =>
        current.map((t) => (t.key === key ? { ...t, ...patch } : t)),
      )
    },
    [],
  )

  const remove = useCallback((key: string) => {
    setTrack((current) => current.filter((t) => t.key !== key))
    setSelectedKey((k) => (k === key ? null : k))
  }, [])

  /** Move one clip one place along the track. */
  const move = useCallback((key: string, delta: -1 | 1) => {
    setTrack((current) => {
      const from = current.findIndex((t) => t.key === key)
      const to = from + delta
      if (from < 0 || to < 0 || to >= current.length) return current
      const next = [...current]
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      return next
    })
  }, [])

  /**
   * Read the real length of anything on the track that does not have one yet.
   *
   * Asked for once per track entry -- the ref is what stops the effect
   * re-requesting on its own state update, since writing a duration changes
   * `track`, which is what the effect depends on.
   */
  const asked = useRef(new Set<string>())
  useEffect(() => {
    for (const t of track) {
      if (t.duration != null || asked.current.has(t.key)) continue
      asked.current.add(t.key)
      clipDuration(imageUrl(t.clip.id))
        .then((duration) => update(t.key, { duration }))
        .catch(() => {
          // A clip whose length cannot be read stays at zero, which shows as
          // an unexportable timeline rather than a silently wrong cut.
          asked.current.delete(t.key)
        })
    }
  }, [track, update])

  const selected = track.find((t) => t.key === selectedKey) ?? null

  const totalSeconds = useMemo(() => {
    const material = track.reduce((sum, t) => sum + trimmedLength(t), 0)
    // Every crossfade overlaps two clips, so it costs its own length once per
    // join -- the same arithmetic the server does, shown before you commit to
    // an encode.
    const joins = Math.max(0, track.length - 1)
    return Math.max(0, material - (transition > 0 ? transition * joins : 0))
  }, [track, transition])

  /** The shortest thing a crossfade has to fit inside. */
  const shortest = useMemo(
    () =>
      track.length === 0 ? 0 : Math.min(...track.map((t) => trimmedLength(t))),
    [track],
  )

  const ready = track.length > 0 && track.every((t) => trimmedLength(t) > 0)
  const transitionFits =
    track.length < 2 || transition === 0 || transition < shortest

  const run = useCallback(async () => {
    if (!ready) return
    setIsExporting(true)
    setError(null)
    setExported(null)
    try {
      const result = await exportTimeline({
        clips: track.map((t) => ({
          clipId: t.clip.id,
          inSeconds: t.inSeconds,
          outSeconds: t.outSeconds ?? t.duration ?? 0,
        })),
        transitionSeconds: transition,
        title: title.trim() || 'Edit',
      })
      setExported(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }, [ready, track, transition, title])

  return {
    clips,
    track,
    selected,
    selectedKey,
    setSelectedKey,
    pickerOpen,
    setPickerOpen,
    add,
    update,
    remove,
    move,
    transition,
    setTransition,
    title,
    setTitle,
    totalSeconds,
    shortest,
    transitionFits,
    canExport: ready && transitionFits && !isExporting,
    isExporting,
    exported,
    error,
    run,
    clear: useCallback(() => {
      setTrack([])
      setSelectedKey(null)
      setExported(null)
    }, []),
  }
}
