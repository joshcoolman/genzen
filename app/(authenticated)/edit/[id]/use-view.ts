'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { writeCut } from '../_actions/edits.action'
import { exportToVideo } from '../_actions/export.action'
import { totalSeconds } from './cut'
import type { PlayableItem } from './_components/cut-player/cut-player'
import type { Edit } from '../_lib/types'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { aspectRatio } from '#/features/video/clip-facts'
import { toast } from '#/components'

/** The row's requested length, or a guess a metadata load will correct. */
function requestedSeconds(clip: VideoRecord): number {
  const seconds = clip.generation_metadata?.duration_seconds
  return typeof seconds === 'number' && seconds > 0 ? seconds : 5
}

/**
 * A cut of trimmed clips, in the order they play (#726).
 *
 * Director's hook with a span per clip. The state is the list of
 * `{ key, clip, in, out }`; the key is client-side and stable across reorders,
 * because one clip may be in the cut twice and a position is not an identity.
 * It is stripped before the write -- the row stores `{ id, in, out }`.
 *
 * Saved on every change against the revision, one write at a time, on
 * Director's reasoning; a failed save is said, not rolled back.
 */
export function useView(edit: Edit, clips: Array<VideoRecord>) {
  const [items, setItems] = useState<Array<PlayableItem>>(() => {
    const byId = new Map(clips.map((c) => [c.id, c]))
    return edit.cut.clips.flatMap((stored) => {
      const clip = byId.get(stored.id)
      return clip
        ? [{ key: crypto.randomUUID(), clip, in: stored.in, out: stored.out }]
        : []
    })
  })

  const revision = useRef(edit.revision)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const serialise = (list: Array<PlayableItem>) =>
    JSON.stringify(list.map((i) => [i.clip.id, i.in, i.out]))
  const saved = useRef(serialise(items))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const key = serialise(items)
    if (key === saved.current) return
    saved.current = key
    const stored = items.map((i) => ({ id: i.clip.id, in: i.in, out: i.out }))
    queue.current = queue.current.then(async () => {
      try {
        revision.current = (
          await writeCut(edit.id, revision.current, stored)
        ).revision
        setError(null)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'The cut could not be saved.',
        )
      }
    })
  }, [items, edit.id])

  /* Each clip's real length, learned as the player or a tile loads its
     metadata. The out handle stops there. */
  const [durations, setDurations] = useState<Map<string, number>>(new Map())
  const learnDuration = useCallback((id: string, seconds: number) => {
    setDurations((current) => {
      if (current.get(id) === seconds) return current
      return new Map(current).set(id, seconds)
    })
  }, [])

  const [picking, setPicking] = useState(false)
  const add = useCallback((chosen: Array<VideoRecord>) => {
    setItems((current) => [
      ...current,
      ...chosen.map((clip) => ({
        key: crypto.randomUUID(),
        clip,
        in: 0,
        out: requestedSeconds(clip),
      })),
    ])
  }, [])

  const remove = useCallback((key: string) => {
    setItems((current) => current.filter((i) => i.key !== key))
  }, [])

  const move = useCallback((from: number, to: number) => {
    setItems((current) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= current.length ||
        to >= current.length
      )
        return current
      const next = [...current]
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      return next
    })
  }, [])

  const trim = useCallback((key: string, span: { in: number; out: number }) => {
    setItems((current) =>
      current.map((i) => (i.key === key ? { ...i, ...span } : i)),
    )
  }, [])

  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [time, setTime] = useState(0)

  /** The first clip's shape sets the stage's, as Director's does. */
  /**
   * Export: the cut as one clip on the Video wall. Awaited in place -- a
   * server action that runs ffmpeg over every clip takes seconds to a couple
   * of minutes, and the button says so while it does. The save queue is
   * awaited first so the file is cut from the edit as it is on screen.
   */
  const [exporting, setExporting] = useState(false)
  const exportCut = useCallback(async () => {
    if (exporting || items.length === 0) return
    setExporting(true)
    try {
      await queue.current
      const { videoId } = await exportToVideo(edit.id)
      toast.success('Exported to the Video wall', {
        action: {
          label: 'Open Video',
          onClick: () => window.open(`/video#${videoId}`, '_self'),
        },
      })
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The export failed.')
    } finally {
      setExporting(false)
    }
  }, [edit.id, exporting, items.length])

  const runRatio = useMemo(
    () => (items[0] ? aspectRatio(items[0].clip) : null),
    [items],
  )
  const total = useMemo(() => totalSeconds(items), [items])

  return {
    items,
    durations,
    learnDuration,
    error,
    picking,
    setPicking,
    add,
    remove,
    move,
    trim,
    playingIndex,
    setPlayingIndex,
    time,
    setTime,
    runRatio,
    total,
    exporting,
    exportCut,
  }
}
