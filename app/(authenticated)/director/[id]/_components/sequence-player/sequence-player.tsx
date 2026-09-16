'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Repeat, Volume2, VolumeX } from 'lucide-react'
import styles from './sequence-player.module.css'
import type { CSSProperties, RefObject } from 'react'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'

const srcFor = (clip: VideoRecord) => `/img/${clip.id}`

export interface SequencePlayerHandle {
  /** Land on a clip and play it from its first frame. */
  playFrom: (index: number) => void
  /** Whether the stage is running, so a caller can leave it be. */
  isPlaying: () => boolean
}

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
 * **There is no transport bar, because the run itself is the transport**
 * (#655). Clicking a thumbnail plays from that clip, which is absolute where
 * Previous/Next were relative and is aimed at the tile you are already looking
 * at; the stage toggles play/pause; and the run loops, so Start over is a click
 * on tile 1 that you rarely need. Working out an order is watch, move a tile,
 * watch again -- every control under the player was a detour around a tile
 * already on screen.
 *
 * **Nothing is drawn over the footage.** No play glyph, no overlay: clips play,
 * a click stops them, and the behaviour is legible from the behaviour.
 *
 * **It always plays.** Adding the first clip starts the run, and so does a run
 * restored from the last visit -- though a browser may refuse that one, since
 * nobody clicked and the sound is on; the stage then sits stopped and one
 * click starts it. The end of the run rejoins clip 1. A one-clip run therefore loops on its own, which is odd
 * and accepted: suppressing it means a rule about set size in the one place
 * that should have no rules at all.
 *
 * **Unless told not to loop** (#670). A chat is a conversation: an answer
 * plays once and the stage stops on its last frame, the way a person stops
 * talking, and a Loop button beside Mute turns the run's behaviour back on.
 * The button appears only when the caller owns the choice; a run has no
 * choice and no button.
 *
 * **And when it stops because the run ran out, it picks up when the run
 * grows.** A chat's bursts land one at a time and play as they arrive, so the
 * stage reaching the end of what is ready is a wait, not an ending: the next
 * clip appearing continues from where it stopped. A pause the person made is
 * not that -- `starved` tells the two apart.
 *
 * **Sound is on by default and mutes both elements at once.** A run is one
 * thing to watch, so a mute that applied to whichever element happened to be on
 * top would come back at the next join. Mute is also the only control no
 * thumbnail click can reach, which is why it is the one button left.
 *
 * Jumping costs the gapless join: the idle element is holding the clip after
 * this one, so a jump anywhere else takes a fresh source and blanks for a beat
 * while it loads. Only that one join -- from there on the preload is back in
 * step, so "click tile 1 and watch the run" is judged at full quality.
 */
export function SequencePlayer({
  clips,
  ratio,
  controls,
  onIndexChange,
  placeholder = 'Add clips below to start the run.',
  stageMax,
  loop = true,
  onLoopChange,
}: {
  clips: Array<VideoRecord>
  /** The run's shape as width over height, so the stage is drawn at it rather
   *  than at 16:9 with the clip floating inside. Null while nothing is
   *  finished, which falls back to 16:9. */
  ratio?: number | null
  controls?: RefObject<SequencePlayerHandle | null>
  /** Which clip the stage is on, so the row can mark it (#512). Reported
   *  whether or not it is playing: the tile the highlight is on is the clip
   *  that is loaded, and pausing does not move it. */
  onIndexChange?: (index: number) => void
  /** What the empty stage says. A chat has no clips to add (#670). */
  placeholder?: string
  /** The tallest the stage may be, as a CSS length; 70vh when unset. */
  stageMax?: string
  /** Rejoin clip 1 after the last clip. On unless the caller says otherwise. */
  loop?: boolean
  /** Given, the stage shows a Loop toggle and reports presses here. */
  onLoopChange?: (loop: boolean) => void
}) {
  const a = useRef<HTMLVideoElement>(null)
  const b = useRef<HTMLVideoElement>(null)
  const els = [a, b]

  const [index, setIndex] = useState(0)
  /** Which of the two elements is on top and playing. */
  const [active, setActive] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
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
  const loopRef = useRef(loop)
  loopRef.current = loop
  /** Stopped because there was nothing after the clip that ended, rather
   *  than because someone pressed pause. */
  const starved = useRef(false)

  /**
   * Keep each element pointed at the right clip: the active one at `index`, the
   * idle one at the clip that follows, ready to take over.
   *
   * Assignment is guarded on the value, which is what makes the swap free --
   * the element taking over was already loaded as the idle one, so nothing is
   * re-fetched and nothing re-decodes.
   *
   * **On the last clip the idle one holds clip 0**, not nothing: the run loops,
   * so the join back to the top is a join like any other, and it is the one you
   * see most while arranging.
   *
   * **A src that is already right is still rewound.** An element that has
   * played to its end and is handed the same clip again sits at its duration,
   * and playing it fires `ended` immediately -- a two-clip run would spin
   * through the loop point as fast as the events dispatch.
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

    const nextClip = clips.at(index + 1) ?? clips.at(0)
    if (idle) {
      if (nextClip) {
        const nextSrc = srcFor(nextClip)
        if (!idle.src.endsWith(nextSrc)) idle.src = nextSrc
        else if (idle.currentTime !== 0) idle.currentTime = 0
      } else {
        blank(idle)
      }
    }
  }, [index, active, clips])

  /** A clip finished. Hand over to the idle element, wrapping at the end. */
  const handleEnded = useCallback(
    (from: number) => {
      if (from !== active) return
      const run = clipsRef.current
      if (run.length === 0) {
        setIsPlaying(false)
        return
      }
      if (index + 1 >= run.length && !loopRef.current) {
        // The end, and nothing rejoins: stop on the last frame. The element
        // keeps its source, so the picture stays and a tile click restarts --
        // or the next clip landing does, see below.
        starved.current = true
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
   * Land on a clip and play it, from wherever the run had got to.
   *
   * **Done here rather than by setting state and letting the effect do it.**
   * That was the first version of Start over and it did nothing at all when the
   * run was already on clip 1: `setIndex(0)` and `setActive(0)` are no-ops
   * then, React bails out of the render, the effect never re-runs -- and the
   * pause it had already done was the only thing that happened. Pressing Start
   * over stopped the video. Every jump goes through here for that reason, since
   * a click on the tile that is already playing is the same trap -- and that
   * click has to mean "play this from its first frame" like every other.
   *
   * So the element is driven directly and the state follows. Element `a` always
   * takes the target, whichever of the two happened to be playing. When it
   * already holds that clip the seek is a `currentTime` of 0 and costs nothing;
   * otherwise it takes a new source, and `play()` waits for the data on its own
   * -- no `currentTime` first, since a fresh source starts at zero anyway and
   * seeking before metadata lands is ignored.
   */
  const jumpTo = useCallback(
    (target: number) => {
      const first = a.current
      if (clips.length === 0 || !first) return
      const next = Math.max(0, Math.min(target, clips.length - 1))

      // Both, not just the visible one: the other is mid-clip with its own
      // buffer and would otherwise keep playing underneath.
      b.current?.pause()
      first.pause()

      const src = srcFor(clips[next])
      if (first.src.endsWith(src)) first.currentTime = 0
      else first.src = src

      starved.current = false
      setActive(0)
      setIndex(next)
      setIsPlaying(true)
      void first.play().catch((err: unknown) => {
        /* An `AbortError` means a new source replaced this one mid-play and a
           fresh `play()` is already coming -- nothing to report.

           `NotAllowedError` is the real case (#659): a run restored on load
           starts itself without anyone having clicked, and sound is on, so the
           browser refuses. Saying so leaves the stage in a stopped state a
           click starts, instead of a Pause label over a still picture. */
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setIsPlaying(false)
        }
      })
    },
    [clips],
  )

  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying
  useImperativeHandle(
    controls,
    () => ({ playFrom: jumpTo, isPlaying: () => isPlayingRef.current }),
    [jumpTo],
  )

  const toggle = useCallback(() => {
    if (clips.length === 0) return
    const el = els[active].current
    if (!el) return
    starved.current = false
    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
    } else {
      void el.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [active, clips.length, isPlaying])

  /* A run that empties, or loses the clip that was playing, goes back to the
     start rather than to a stopped element pointing at nothing. */
  useEffect(() => {
    if (index < clips.length) return
    setIsPlaying(false)
    setActive(0)
    setIndex(0)
  }, [clips.length, index])

  /* The first clip in an empty run starts the run. There is no stopped state
     to press Play from any more, so a run that sat still after something was
     put in it would be the old model half-removed. Guarded on the transition
     rather than on `length`, so later additions do not interrupt what is
     already playing. */
  const wasEmpty = useRef(true)
  useEffect(() => {
    const empty = clips.length === 0
    if (wasEmpty.current && !empty) jumpTo(0)
    wasEmpty.current = empty
  }, [clips.length, jumpTo])

  /* The clip after the one the stage starved on has arrived: carry on. Only
     when starved, so a run growing under a deliberate pause stays paused. */
  useEffect(() => {
    if (!starved.current || index + 1 >= clips.length) return
    jumpTo(index + 1)
  }, [clips.length, index, jumpTo])

  /* An effect rather than a call inside each handler: `index` moves from the
     `ended` handler, from a jump and from a run that shrinks underneath it, and
     three call sites is three chances for one of them to stop reporting. */
  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  const empty = clips.length === 0

  return (
    <div className={styles.player}>
      {/* A button, so the one thing the stage does is reachable from the
          keyboard too. Nothing is drawn on it: the label lives on `aria-label`
          and the footage stays uncovered. */}
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
        {onLoopChange && (
          <button
            type="button"
            className={styles.transport}
            onClick={() => onLoopChange(!loop)}
            disabled={empty}
            aria-pressed={loop}
            aria-label={loop ? 'Stop looping' : 'Loop'}
          >
            <Repeat size={14} />
            {loop ? 'Looping' : 'Loop'}
          </button>
        )}
      </div>
    </div>
  )
}
