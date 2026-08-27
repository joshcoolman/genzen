'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import styles from './sequence-player.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'

const srcFor = (clip: VideoRecord) => `/img/${clip.id}`

/**
 * Empty an element so the stage is actually blank.
 *
 * Dropping `src` alone is not enough: the last decoded frame stays painted, so
 * removing the final clip from the run left the video that had just been
 * playing sitting on top of the "add clips" message. `load()` is what resets
 * the element to nothing, and the pause stops a clip that is still running from
 * carrying on inaudibly against a source that is already gone.
 */
function blank(el: HTMLVideoElement) {
  if (!el.getAttribute('src')) return
  el.pause()
  el.removeAttribute('src')
  el.load()
}

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
 * **Sound is on by default and mutes both elements at once.** A run is one
 * thing to watch, so a mute that applied to whichever element happened to be on
 * top would come back at the next join. Autoplay policy is not in the way here:
 * every play starts from a button, so a browser allows the audio.
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
  const [muted, setMuted] = useState(false)

  /* Set on the elements rather than through the `muted` attribute, which React
     does not keep in sync with the property after the first render -- a known
     gap, and the reason a `muted={...}` prop silently stops working. Both
     elements, always, so the idle one is already right when it takes over. */
  useEffect(() => {
    for (const ref of [a, b]) {
      if (ref.current) ref.current.muted = muted
    }
  }, [muted])

  /* Read inside the `ended` handler, which is bound to an element rather than
     re-created per render -- the handler must see the run as it is now, not as
     it was when it was attached. Reordering during playback lands through here:
     the clip already playing finishes, and the next one is whatever the row
     says by then. */
  const clipsRef = useRef(clips)
  clipsRef.current = clips

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
        blank(current)
      }
    }

    const nextClip = clips.at(index + 1)
    if (idle) {
      if (nextClip) {
        const nextSrc = srcFor(nextClip)
        if (!idle.src.endsWith(nextSrc)) idle.src = nextSrc
      } else {
        blank(idle)
      }
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
   * Back to clip 1 and play, from wherever the run had got to.
   *
   * **Done here rather than by setting state and letting the effect do it.**
   * That was the first version and it did nothing at all when the run was
   * already on clip 1: `setIndex(0)` and `setActive(0)` are no-ops then, React
   * bails out of the render, the effect never re-runs -- and the pause it had
   * already done was the only thing that happened. Pressing Start over stopped
   * the video.
   *
   * So the element is driven directly and the state follows. Element `a` always
   * takes clip 1, whichever of the two happened to be playing. When it already
   * holds that clip the seek is a `currentTime` of 0 and costs nothing; when it
   * was holding the preloaded next clip it takes a new source, and `play()`
   * waits for the data on its own -- no `currentTime` first, since a fresh
   * source starts at zero anyway and seeking before metadata lands is ignored.
   */
  const restart = useCallback(() => {
    const first = a.current
    if (clips.length === 0 || !first) return

    // Both, not just the visible one: the other is mid-clip with its own buffer
    // and would otherwise keep playing underneath.
    b.current?.pause()
    first.pause()

    const src = srcFor(clips[0])
    if (first.src.endsWith(src)) first.currentTime = 0
    else first.src = src

    setAtEnd(false)
    setActive(0)
    setIndex(0)
    setIsPlaying(true)
    // Swallowed: reassigning `src` can abort an in-flight play with an
    // AbortError that means nothing here.
    void first.play().catch(() => {})
  }, [clips])

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
