'use client'

import { useEffect, useState } from 'react'
import styles from './export-tile.module.css'
import type { Clip } from '../../clips'

export function ExportTile({
  clip,
  index,
  selected,
  disabled,
  onChange,
}: {
  clip: Clip
  index: number
  selected: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const source = URL.createObjectURL(clip.blob)
    setUrl(source)
    return () => URL.revokeObjectURL(source)
  }, [clip.blob])
  return (
    <div className={styles.tile} data-selected={selected}>
      <video
        src={url}
        muted
        playsInline
        controls
        preload="metadata"
        aria-label={`Preview section ${index + 1}`}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (!Number.isFinite(video.duration)) {
            video.addEventListener(
              'seeked',
              () => {
                video.currentTime = 0
              },
              { once: true },
            )
            video.currentTime = 1e10
          }
        }}
        onVolumeChange={(event) => {
          event.currentTarget.muted = true
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        Section {index + 1} · {clip.duration.toFixed(1)}s
      </label>
      <p>{clip.prompt}</p>
    </div>
  )
}
