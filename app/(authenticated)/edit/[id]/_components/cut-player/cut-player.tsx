'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { startOf } from '../../cut'
import styles from './cut-player.module.css'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'

const srcFor = (clip: VideoRecord) => `/img/${clip.id}`

/** A clip on the timeline with the span of it that is kept. */
export interface PlayableItem {
  /** Stable across reorders, unlike the position; unique, unlike the id. */
  key: string
  clip: VideoRecord
  in: number
  out: number
}

export interface CutPlayerHandle {
  /** Land on a clip and play it from `offset` seconds into its kept span. */
  playFrom: (index: number, offset?: number) => void
  /** Land there and stay as you were: playing carries on from the new spot,
   *  paused shows its frame. A tile click is a move, not a play button. */
  seekTo: (index: number, offset?: number) => void
  toggle: () => void
  isPlaying: () => boolean
}

/** How close to `out` counts as reached. A frame at 60fps is 0.017s; half of
 *  one keeps the swap from waiting out a whole extra frame. */
const OUT_EPSILON = 1 / 120

function blank(el: HTMLVideoElement) {
  if (!el.getAttribute('src')) return
  el.pause()
  el.removeAttribute('src')
  el.load()
}

/**
 * Director's sequence player with in and out points (#726).
 *
 * The mechanism is the same -- two `<video>` elements ping-ponging, the
 * visible one playing while the hidden one holds the next clip already
 * decoded, so a join costs nothing -- and two things are added:
 *
 * **A clip starts at `in`, not at zero.** A `currentTime` set before metadata
 * has landed is ignored, so each element carries a pending seek that
 * `loadedmetadata` applies. The idle element is loaded, seeked to its `in` and
 * left there, so the swap lands on the right frame.
 *
 * **A clip ends at `out`, not at `ended`.** `requestVideoFrameCallback` runs
 * once per presented frame and is where the swap is decided; `timeupdate`
 * fires about four times a second and would overshoot a trim by up to a
 * quarter of a second, which is the kind of error a trim exists to remove.
 * `ended` stays as the fallback for a file shorter than its row claims. The
 * same callback reports the run's clock, which is what the playhead draws.
 *
 * The run always loops, as Director's does.
 */
export function CutPlayer({
  items,
  ratio,
  controls,
  onIndexChange,
  onTimeChange,
  onDuration,
  placeholder = 'Add clips below to start the cut.',
  stageMax,
  children,
}: {
  items: Array<PlayableItem>
  ratio?: number | null
  controls?: RefObject<CutPlayerHandle | null>
  onIndexChange?: (index: number) => void
  /** Seconds on the run's clock, once per presented frame while playing and
   *  once per seek while not. */
  onTimeChange?: (seconds: number) => void
  /** A clip's real length, learned from its metadata. The row's
   *  `duration_seconds` is what was requested; this is what came back. */
  onDuration?: (clipId: string, seconds: number) => void
  placeholder?: string
  stageMax?: string
  /** Whatever sits beside Mute: the clock, Export. */
  children?: ReactNode
}) {
  const a = useRef<HTMLVideoElement>(null)
  const b = useRef<HTMLVideoElement>(null)
  const els = [a, b]

  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    for (const ref of [a, b]) {
      if (ref.current) ref.current.muted = muted
    }
  }, [muted])

  const itemsRef = useRef(items)
  itemsRef.current = items
  const indexRef = useRef(index)
  indexRef.current = index
  /** A seek each element owes once its metadata lands. */
  const pendingSeek = useRef<[number | null, number | null]>([null, null])
  /** Which clip each element is loaded with, so its metadata is credited to
   *  the right row whether it is the one playing or the one waiting. */
  const holding = useRef<[string | null, string | null]>([null, null])
  const onTimeRef = useRef(onTimeChange)
  onTimeRef.current = onTimeChange
  const onDurationRef = useRef(onDuration)
  onDurationRef.current = onDuration

  /** Point an element at a clip and a moment in it. A same-source element
   *  seeks in place; a new source seeks when its metadata arrives. */
  const load = useCallback(
    (which: number, el: HTMLVideoElement, item: PlayableItem, at: number) => {
      const src = srcFor(item.clip)
      if (el.src.endsWith(src)) {
        if (Math.abs(el.currentTime - at) > OUT_EPSILON) el.currentTime = at
        pendingSeek.current[which] = null
      } else {
        el.src = src
        pendingSeek.current[which] = at
      }
    },
    [],
  )

  const handleMetadata = useCallback((which: number) => {
    const el = els[which].current
    if (!el) return
    const clipId = holding.current[which]
    if (clipId && Number.isFinite(el.duration)) {
      onDurationRef.current?.(clipId, el.duration)
    }
    const at = pendingSeek.current[which]
    if (at !== null) {
      el.currentTime = at
      pendingSeek.current[which] = null
    }
  }, [])

  /**
   * Keep each element pointed at the right clip: the active one at `index`,
   * the idle one at the clip after it, seeked to its `in` and waiting. On the
   * last clip the idle one holds clip 0, because the run loops.
   *
   * The active element is left alone when its source is already right: it is
   * playing, and reseeking it to `in` on every trim of a neighbour would
   * restart the shot. A trim of *its own* out point is read by the frame
   * callback below off `itemsRef`, so it needs no reload.
   */
  useEffect(() => {
    const current = els[active].current
    const idle = els[1 - active].current

    const currentItem = items.at(index)
    if (current) {
      if (currentItem) {
        if (!current.src.endsWith(srcFor(currentItem.clip))) {
          load(active, current, currentItem, currentItem.in)
          /* A new source resets the element to paused. This happens when the
             clip that was playing is removed and the next one takes its place
             -- the stage should carry on, not stop with Pause showing. */
          if (isPlayingRef.current) void current.play().catch(() => {})
        }
      } else blank(current)
    }

    const nextItem = items.at(index + 1) ?? items.at(0)
    if (idle) {
      if (nextItem) load(1 - active, idle, nextItem, nextItem.in)
      else blank(idle)
    }
  }, [index, active, items, load])

  /** The clip reached its out point (or its file ran out). Hand over. */
  const handleEnded = useCallback(
    (from: number) => {
      if (from !== active) return
      const run = itemsRef.current
      if (run.length === 0) {
        setIsPlaying(false)
        return
      }
      const next = index + 1 >= run.length ? 0 : index + 1
      const takingOver = 1 - active
      setActive(takingOver)
      setIndex(next)
      void els[takingOver].current?.play().catch(() => {})
    },
    [active, index],
  )

  /**
   * Once per presented frame while the active element plays: report the
   * clock, and swap at `out`. Registered against the element, so a swap
   * re-registers on the one taking over and the cleanup cancels the old.
   */
  useEffect(() => {
    const el = els[active].current
    if (!el || !isPlaying) return
    const tick = () => {
      const item = itemsRef.current.at(indexRef.current)
      if (!item) return
      const t = el.currentTime
      onTimeRef.current?.(
        startOf(itemsRef.current, indexRef.current) + Math.max(0, t - item.in),
      )
      if (t >= item.out - OUT_EPSILON) handleEnded(active)
    }
    let handle = 0
    const loop = () => {
      tick()
      handle = el.requestVideoFrameCallback(loop)
    }
    handle = el.requestVideoFrameCallback(loop)
    return () => el.cancelVideoFrameCallback(handle)
  }, [active, isPlaying, handleEnded])

  /**
   * Land on a clip at an offset into its kept span and play. Element `a`
   * always takes the target, as in Director, and for the same reason: the
   * state alone cannot restart the clip already showing.
   */
  const jumpTo = useCallback(
    (target: number, offset = 0, play = true) => {
      const first = a.current
      if (items.length === 0 || !first) return
      const next = Math.max(0, Math.min(target, items.length - 1))
      const item = items[next]
      const at = item.in + Math.max(0, Math.min(offset, item.out - item.in))

      b.current?.pause()
      first.pause()
      load(0, first, item, at)

      setActive(0)
      setIndex(next)
      setIsPlaying(play)
      onTimeRef.current?.(startOf(items, next) + (at - item.in))
      if (!play) return
      void first.play().catch((err: unknown) => {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setIsPlaying(false)
        }
      })
    },
    [items, load],
  )

  const toggle = useCallback(() => {
    if (items.length === 0) return
    const el = els[active].current
    if (!el) return
    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
    } else {
      void el.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [active, items.length, isPlaying])

  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying
  useImperativeHandle(
    controls,
    () => ({
      playFrom: (target, offset) => jumpTo(target, offset, true),
      seekTo: (target, offset) => jumpTo(target, offset, isPlayingRef.current),
      toggle,
      isPlaying: () => isPlayingRef.current,
    }),
    [jumpTo, toggle],
  )

  useEffect(() => {
    if (index < items.length) return
    setIsPlaying(false)
    setActive(0)
    setIndex(0)
  }, [items.length, index])

  const wasEmpty = useRef(true)
  useEffect(() => {
    const empty = items.length === 0
    if (wasEmpty.current && !empty) jumpTo(0)
    wasEmpty.current = empty
  }, [items.length, jumpTo])

  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  const empty = items.length === 0

  return (
    <div className={styles.player}>
      <button
        type="button"
        className={styles.stage}
        style={
          {
            ...(ratio ? { '--stage-ratio': ratio } : {}),
            ...(stageMax ? { '--stage-max': stageMax } : {}),
          } as CSSProperties
        }
        onClick={toggle}
        disabled={empty}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {[a, b].map((ref, i) => (
          <video
            key={i}
            ref={ref}
            className={i === active ? styles.videoActive : styles.video}
            playsInline
            preload="auto"
            onLoadedMetadata={() => handleMetadata(i)}
            onEnded={() => handleEnded(i)}
          />
        ))}
        {empty && <span className={styles.placeholder}>{placeholder}</span>}
      </button>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.transport}
          onClick={() => setMuted((m) => !m)}
          disabled={empty}
          aria-pressed={muted}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {muted ? 'Muted' : 'Sound'}
        </button>
        {children}
      </div>
    </div>
  )
}
