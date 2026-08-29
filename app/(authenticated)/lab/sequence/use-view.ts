'use client'

import { useCallback, useState } from 'react'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { aspectRatio } from '#/features/video/clip-facts'

/**
 * A run of clips, in the order they should be watched.
 *
 * **The order is the entire state.** There is no timeline model here -- no
 * global clock, no per-clip offsets, no trims. A sequence is an array, and
 * rearranging it is `move`. Everything a real editor would add (a time ruler,
 * a scrubber that spans clips, proportional widths) needs a global timeline,
 * and a global timeline is what turns this into an editor rather than a way to
 * answer "do these cut together?" (#497).
 *
 * Nothing is persisted, the same bargain every lab page makes: the clips
 * themselves are rows in the library and survive; the arrangement does not.
 */
export function useView(clips: Array<VideoRecord>) {
  const [picked, setPicked] = useState<Array<VideoRecord>>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  /**
   * Which clip the player is on, so the row can mark it (#512).
   *
   * Lifted here rather than read out of the player, because the player is the
   * only thing that knows -- it moves at `ended`, at a skip, and when the run
   * shrinks under it -- and the row is its sibling, not its child. Null while
   * the run is empty, which is the state where no tile should be lit.
   */
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  /**
   * Append, skipping anything already in the run.
   *
   * A clip twice in one sequence is a real thing to want eventually and a
   * confusing thing to get by accident, since the picker shows what is already
   * picked. Appending only what is new means the row's ids stay unique, which
   * is what lets a card key on one.
   */
  const addClips = useCallback((chosen: Array<VideoRecord>) => {
    setPicked((current) => {
      const have = new Set(current.map((c) => c.id))
      return [...current, ...chosen.filter((c) => !have.has(c.id))]
    })
  }, [])

  const removeClip = useCallback((id: string) => {
    setPicked((current) => current.filter((c) => c.id !== id))
  }, [])

  const clear = useCallback(() => setPicked([]), [])

  /** Lift one clip out and drop it in at `to`, everything else closing up. */
  const move = useCallback((from: number, to: number) => {
    setPicked((current) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= current.length ||
        to >= current.length
      ) {
        return current
      }
      const next = [...current]
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      return next
    })
  }, [])

  return {
    clips,
    picked,
    /* The shape of the run, which is the shape of whatever went into it first.
       Null while the run is empty, and null too if that clip's poster never
       decoded -- an unknown shape must not become a constraint nothing can
       satisfy. */
    runRatio: picked.length > 0 ? aspectRatio(picked[0]) : null,
    playingIndex: picked.length > 0 ? playingIndex : null,
    setPlayingIndex,
    pickerOpen,
    setPickerOpen,
    addClips,
    removeClip,
    clear,
    move,
  }
}
