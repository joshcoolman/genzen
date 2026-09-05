'use client'

import { useEffect, useRef, useState } from 'react'
import { CutPlayback } from '../../playback'
import styles from './cut-player.module.css'
import type { Clip } from '../../clips'
import { Button } from '#/components'

export function CutPlayer({ clips }: { clips: Array<Clip> }) {
  const a = useRef<HTMLVideoElement>(null)
  const b = useRef<HTMLVideoElement>(null)
  const engine = useRef<CutPlayback | null>(null)
  const urls = useRef(new Map<string, string>())
  const [position, setPosition] = useState({
    active: 0,
    index: -1,
    paused: false,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!a.current || !b.current) return
    engine.current = new CutPlayback(
      [a.current, b.current],
      (active, index, paused) => setPosition({ active, index, paused }),
      setError,
    )
    return () => {
      engine.current?.dispose()
      engine.current = null
      urls.current.forEach((url) => URL.revokeObjectURL(url))
      urls.current.clear()
    }
  }, [])
  useEffect(() => {
    engine.current?.setClips(
      clips.map((clip) => {
        let url = urls.current.get(clip.id)
        if (!url) {
          url = URL.createObjectURL(clip.blob)
          urls.current.set(clip.id, url)
        }
        return { id: clip.id, url }
      }),
    )
    // A replaced clip may still be playing: keep its URL until clear/unmount.
    if (!clips.length) {
      urls.current.forEach((url) => URL.revokeObjectURL(url))
      urls.current.clear()
    }
  }, [clips])
  const empty = clips.length === 0
  return (
    <div>
      <div className={styles.stage}>
        {[a, b].map((ref, index) => (
          <video
            key={index}
            ref={ref}
            className={position.active === index ? styles.active : styles.video}
            muted
            playsInline
            preload="auto"
            aria-label={
              position.active === index
                ? 'Silent clip sequence'
                : 'Preloaded next clip'
            }
            aria-hidden={position.active !== index}
          />
        ))}
        {empty && (
          <p className={styles.empty}>
            Send an idea to create the first section.
          </p>
        )}
      </div>
      <div className={styles.controls}>
        <Button
          disabled={empty}
          onClick={() => {
            setError(null)
            engine.current?.toggle()
          }}
        >
          {position.paused ? 'Play' : 'Pause'}
        </Button>
        <Button
          disabled={empty || position.index <= 0}
          onClick={() => engine.current?.previous()}
        >
          Previous clip
        </Button>
        <Button disabled={empty} onClick={() => engine.current?.next()}>
          Next clip
        </Button>
        <Button
          disabled={empty}
          onClick={() => engine.current?.latest()}
          title="Play the last two seconds before the newest section"
        >
          Jump to latest
        </Button>
        <span>
          {empty
            ? 'Silent playback'
            : `Clip ${position.index + 1} of ${clips.length} · silent loop`}
        </span>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
