'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import styles from './sequence-player.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'

const srcFor = (clip: VideoRecord) => `/img/${clip.id}`

/**
 * One stage that plays a run of clips end to end.
 *
 * **Two `<video>` elements, ping-ponging.** The visible one plays while the
 * next clip loads in the hidden one; at `ended` the two swap which is on top
 * and the newly freed element starts loading the clip after that. The join is a
 * class flip between two elements that are both already decoded, so there is no
 * gap at the cut -- which matters more here than anywhere, because the cut is
 * the thing being judged. One element swapping its own `src` is far simpler and
 * blanks for a beat at every boundary, which would make the page lie about the
 * answer.
 *
 * Not `MediaSource`: appending buffers gaplessly needs fragmented MP4 and one
 * codec across every clip, and FAL's output is guaranteed to be neither.
 *
 * **Its own Play/Pause, because native `controls` cannot work here.** A
 * `<video>`'s bar knows only its own clip, so the scrubber would read 0:00-0:06
 * of whichever clip happens to be showing and reset itself at every join. There
 * is deliberately no scrubber of our own either: one that spans clips needs a
 * global timeline, which is the line this page does not cross (#497).
 *
 * **Start over is its own button, available whenever there is a run** -- not a
 * state the Play button falls into at the end. Rearranging and re-watching from
 * the top is the loop this page exists for, and having to reach the end (or
 * pause, then find a different control) to get back to clip 1 put a wait in the
 * middle of it.
 */
export function SequencePlayer({ clips }: { clips: Array<VideoRecord> }) {
  const a = useRef<HTMLVideoElement>(null)
  const b = useRef<HTMLVideoElement>(null)
  const els = [a, b]

  const [index, setIndex] = useState(0)
  /** Which of the two elements is on top and playing. */
  const [active, setActive] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [atEnd, setAtEnd] = useState(false)

  /* Read inside the `ended` handler, which is bound to an element rather than
     re-created per render -- the handler must see the run as it is now, not as
     it was when it was attached. Reordering during playback lands through here:
     the clip already playing finishes, and the next one is whatever the row
     says by then. */
  const clipsRef = useRef(clips)
  clipsRef.current = clips

  /* Set when a restart needs the new active element to play once its source has
     been assigned. Assigning `src` and calling `play()` in the same tick plays
     whatever was loaded before it. */
  const playWhenReady = useRef(false)

  /**
   * Keep each element pointed at the right clip: the active one at `index`, the
   * idle one at `index + 1`, ready to take over.
   *
   * Assignment is guarded on the value, which is what makes the swap free --
   * the element taking over was already loaded as the idle one, so nothing is
   * re-fetched and nothing re-decodes.
   */
  useEffect(() => {
    const current = els[active].current
    const idle = els[1 - active].current

    /* `.at`, not `[]`: an index past the end is a real state here -- a clip is
       removed from the run while it is the one playing -- and the bracket form
       is typed as though it never happens. */
    const currentClip = clips.at(index)
    const currentSrc = currentClip ? srcFor(currentClip) : null
    if (current) {
      if (currentSrc && !current.src.endsWith(currentSrc)) {
        current.src = currentSrc
      } else if (!currentSrc) {
        current.removeAttribute('src')
      }
    }

    const nextClip = clips.at(index + 1)
    if (idle) {
      if (nextClip) {
        const nextSrc = srcFor(nextClip)
        if (!idle.src.endsWith(nextSrc)) idle.src = nextSrc
      } else {
        idle.removeAttribute('src')
      }
    }

    if (playWhenReady.current && current && currentSrc) {
      playWhenReady.current = false
      current.currentTime = 0
      void current.play()
    }
  }, [index, active, clips])

  /** A clip finished. Hand over to the idle element, or stop on the last frame. */
  const handleEnded = useCallback(
    (from: number) => {
      if (from !== active) return
      const next = index + 1
      if (next >= clipsRef.current.length) {
        setIsPlaying(false)
        setAtEnd(true)
        return
      }
      const takingOver = 1 - active
      setActive(takingOver)
      setIndex(next)
      void els[takingOver].current?.play()
    },
    [active, index],
  )

  /**
   * Back to the first clip, and play. Reaching the end never loops on its own.
   *
   * Nothing plays in here: the effect above assigns the sources first and then
   * honours `playWhenReady`, because assigning `src` and calling `play()` in the
   * same tick plays whatever was loaded before it.
   */
  const restart = useCallback(() => {
    const current = els[active].current
    // The element that is about to stop being active keeps its buffer and would
    // otherwise carry on playing underneath the new one.
    current?.pause()
    setAtEnd(false)
    setIsPlaying(true)
    playWhenReady.current = true
    setActive(0)
    setIndex(0)
  }, [active])

  const toggle = useCallback(() => {
    if (clips.length === 0) return
    if (atEnd) {
      restart()
      return
    }
    const el = els[active].current
    if (!el) return
    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
    } else {
      void el.play()
      setIsPlaying(true)
    }
  }, [active, atEnd, clips.length, isPlaying, restart])

  /* A run that empties, or loses the clip that was playing, goes back to the
     start rather than to a stopped element pointing at nothing. */
  useEffect(() => {
    if (index < clips.length) return
    setIsPlaying(false)
    setAtEnd(false)
    setActive(0)
    setIndex(0)
  }, [clips.length, index])

  const empty = clips.length === 0

  return (
    <div className={styles.player}>
      <div className={styles.stage}>
        {[a, b].map((ref, i) => (
          <video
            key={i}
            ref={ref}
            className={i === active ? styles.videoActive : styles.video}
            playsInline
            preload="auto"
            onEnded={() => handleEnded(i)}
          />
        ))}
        {empty && (
          <p className={styles.placeholder}>
            Add clips below, then play the run.
          </p>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.transport}
          onClick={toggle}
          disabled={empty}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        {/* Always live, playing or not: the point is getting back to clip 1
            without first arriving somewhere it is offered. */}
        <button
          type="button"
          className={styles.transport}
          onClick={restart}
          disabled={empty}
          aria-label="Start over"
        >
          <RotateCcw size={14} />
          Start over
        </button>
        {/* Which clip of how many, and nothing about time. The count is the one
            fact a run has that a single clip does not. */}
        {!empty && (
          <span className={styles.position}>
            Clip {Math.min(index + 1, clips.length)} of {clips.length}
          </span>
        )}
      </div>
    </div>
  )
}
