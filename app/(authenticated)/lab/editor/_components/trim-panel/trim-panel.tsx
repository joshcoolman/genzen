'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { trimmedLength } from '../../use-view'
import styles from './trim-panel.module.css'
import type { TrackClip } from '../../use-view'
import { Button } from '#/components'
import { imageUrl } from '#/lib/image-url'

/**
 * The selected clip, with the part of it you are keeping.
 *
 * **In and out are set from the playhead, not typed.** You find the frame by
 * watching, so the control that marks it is the one you already have your hand
 * on; a pair of number fields would mean reading a timecode off the player and
 * copying it. The numbers are shown, and they are not editable, on purpose --
 * this is a page for judging a cut, not for entering one.
 *
 * **Preview plays the trimmed range only.** Play from the in point, stop at the
 * out point. Watching the whole clip and imagining the trim is exactly the
 * thing an editor exists to stop you doing.
 */
export function TrimPanel({
  track,
  onChange,
}: {
  track: TrackClip
  onChange: (patch: Partial<Omit<TrackClip, 'key' | 'clip'>>) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const duration = track.duration
  const out = track.outSeconds ?? duration ?? 0

  // A different clip selected means a different file: reset the playhead
  // rather than leaving the last clip's position on screen.
  useEffect(() => {
    setTime(track.inSeconds)
    setPlaying(false)
    const el = video.current
    if (el) {
      el.pause()
      el.currentTime = track.inSeconds
    }
    // Keyed on the track entry, not the clip: the same clip twice on the track
    // is two independent trims.
  }, [track.key])

  const seek = useCallback((seconds: number) => {
    const el = video.current
    if (!el) return
    el.currentTime = seconds
    setTime(seconds)
  }, [])

  const toggle = useCallback(() => {
    const el = video.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
      return
    }
    // Restart from the in point when the playhead is already past the range,
    // so pressing play always shows the cut rather than nothing.
    if (el.currentTime < track.inSeconds || el.currentTime >= out) {
      el.currentTime = track.inSeconds
    }
    void el.play()
    setPlaying(true)
  }, [playing, track.inSeconds, out])

  return (
    <div className={styles.panel}>
      <div className={styles.stage}>
        <video
          ref={video}
          className={styles.video}
          src={imageUrl(track.clip.id)}
          preload="metadata"
          playsInline
          onLoadedMetadata={(e) => {
            const el = e.currentTarget
            if (Number.isFinite(el.duration) && el.duration > 0) {
              onChange({ duration: el.duration })
              el.currentTime = track.inSeconds
            }
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget
            setTime(el.currentTime)
            // The stop is here rather than on a timer: `timeupdate` is the only
            // event that fires while playing, and a clip that ran past its out
            // point would be showing a cut that will not exist.
            if (el.currentTime >= out) {
              el.pause()
              setPlaying(false)
            }
          }}
          onEnded={() => setPlaying(false)}
        />
      </div>

      <div className={styles.scrubRow}>
        <Button
          variant="ghost"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play the trimmed range'}
        >
          {playing ? (
            <Pause className={styles.icon} />
          ) : (
            <Play className={styles.icon} />
          )}
        </Button>

        <div className={styles.scrub}>
          {/* The kept range, drawn under the slider. Without it the two numbers
              are the only evidence of the trim, and a trim you cannot see is
              one you have to hold in your head. */}
          {duration != null && duration > 0 && (
            <span
              className={styles.range}
              style={{
                insetInlineStart: `${(track.inSeconds / duration) * 100}%`,
                inlineSize: `${((out - track.inSeconds) / duration) * 100}%`,
              }}
            />
          )}
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={duration ?? 0}
            step={0.01}
            value={time}
            disabled={duration == null}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Playhead"
          />
        </div>

        <span className={styles.time}>{time.toFixed(2)}s</span>
      </div>

      <div className={styles.marks}>
        <Button
          variant="secondary"
          disabled={duration == null || time >= out}
          onClick={() => onChange({ inSeconds: time })}
        >
          Set in
        </Button>
        <Button
          variant="secondary"
          disabled={duration == null || time <= track.inSeconds}
          onClick={() => onChange({ outSeconds: time })}
        >
          Set out
        </Button>
        <span className={styles.readout}>
          in {track.inSeconds.toFixed(2)}s · out {out.toFixed(2)}s ·{' '}
          <strong>{trimmedLength(track).toFixed(2)}s kept</strong>
        </span>
        <Button
          variant="ghost"
          disabled={track.inSeconds === 0 && track.outSeconds == null}
          onClick={() => onChange({ inSeconds: 0, outSeconds: null })}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
