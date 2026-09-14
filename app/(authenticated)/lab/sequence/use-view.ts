'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readRunIds, writeRunIds } from './last-run'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { aspectRatio } from '#/features/video/clip-facts'
import { updateImageMeta } from '#/features/user-images/server/images.action'

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
 * **The arrangement survives navigation, and only the arrangement** (#659).
 * Its clip ids are in `last-run.ts`; everything else about a clip is read off
 * the library row as it is now. Leaving the page and coming back to an empty
 * row meant re-picking eight clips before any work could start, which is the
 * one cost that made the page not worth opening for a small change.
 */
export function useView(clips: Array<VideoRecord>) {
  const [picked, setPicked] = useState<Array<VideoRecord>>([])

  /**
   * Put the stored run back, once, against the library as it is now.
   *
   * **In an effect rather than in `useState`'s initialiser.** The initialiser
   * runs during the server render too, where there is no `localStorage` -- and
   * a run that appeared only after hydration is a hydration mismatch, not a
   * feature.
   *
   * Ids that no longer resolve are dropped rather than held: a clip trashed
   * from Video is gone, and a run cannot show it. Nothing is written back here
   * -- the persist effect below sees the shortened run and stores that.
   */
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const ids = readRunIds()
    if (ids.length === 0) return
    const byId = new Map(clips.map((c) => [c.id, c]))
    const run = ids
      .map((id) => byId.get(id))
      .filter((c): c is VideoRecord => c !== undefined)
    if (run.length > 0) setPicked(run)
  }, [clips])

  /* Guarded on the restore having happened: this fires on mount with an empty
     run, and an unguarded write would erase the stored one before it could be
     read back. */
  useEffect(() => {
    if (!restored.current) return
    writeRunIds(picked.map((c) => c.id))
  }, [picked])
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
  /** The clip whose name is being edited, or null (#657). */
  const [renaming, setRenaming] = useState<VideoRecord | null>(null)

  /**
   * Name a clip, on the clip's own row.
   *
   * **This is the one thing on the page that outlives the page.** A run is not
   * stored -- that bargain holds -- but a name is a fact about a clip, so it
   * goes where every other surface will read it: `user_images.title`, through
   * the action Images already renames stills with. Nothing lab-shaped is being
   * persisted, which is what keeps this on the right side of the rule.
   *
   * Written through optimistically and rolled back on failure. The run is a
   * local copy of rows, so the server's answer is not what the row is read
   * from -- and a name that appears, then vanishes, is a clearer failure than
   * one that takes a round trip to show up while you are typing the next one.
   */
  const renameClip = useCallback(async (clip: VideoRecord, title: string) => {
    const apply = (value: string) =>
      setPicked((current) =>
        current.map((c) => (c.id === clip.id ? { ...c, title: value } : c)),
      )
    apply(title)
    setRenaming(null)
    try {
      // `description` is passed back as it stands: the action writes both
      // columns, so omitting it would clear the clip's prompt.
      await updateImageMeta(clip.id, title, clip.description)
    } catch {
      apply(clip.title)
    }
  }, [])

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
    renaming,
    setRenaming,
    renameClip,
  }
}
