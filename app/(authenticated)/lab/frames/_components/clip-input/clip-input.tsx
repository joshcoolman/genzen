'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ClipPicker } from '../clip-picker/clip-picker'
import { clipFacts } from '../clip-facts'
import styles from './clip-input.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { MediaBox } from '#/components'

/** The strip's tile. Paired with `--tile` in the stylesheet: MediaBox takes a
 *  number, the row's geometry takes a length, and they have to agree. */
const TILE = 56

/**
 * The clip you are working with: a plus button, and the picker behind it.
 *
 * **`RefImageStrip`'s geometry with a clip in the slot** — the same 3.5rem
 * tile, the same dashed add square, the same n/max counter at the end, because
 * choosing a clip should feel like choosing a reference image. It is not that
 * component: the strip renders an `<img>`, and there is no poster frame
 * anywhere in the app for a clip to put in one (no ffmpeg on the server), so
 * the filled slot has to be a `MediaBox`.
 *
 * A scrolling row of every clip was the first version of this, and it is fine
 * at eleven clips and useless at five hundred. A dialog is the thing that
 * scales, and the app already picks images that way.
 *
 * `max` defaults to 1 and nothing here assumes it: several clips picked at once
 * — to stitch, to compare — is a bigger number, not a rewrite.
 */
export function ClipInput({
  clips,
  picked,
  onPick,
  onRemove,
  max = 1,
  disabled,
}: {
  clips: Array<VideoRecord>
  picked: Array<VideoRecord>
  onPick: (clips: Array<VideoRecord>) => void
  onRemove: (id: string) => void
  max?: number
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={styles.root}
      style={{ '--tile': `${TILE}px` } as React.CSSProperties}
    >
      {picked.map((clip) => (
        <div key={clip.id} className={styles.item}>
          {/* The whole tile removes and the X says so, exactly as the reference
              strip does -- aiming at a 12px corner is a lot of precision for "not
              this one". */}
          <button
            type="button"
            className={styles.frame}
            onClick={() => onRemove(clip.id)}
            disabled={disabled}
            aria-label={`Remove ${clip.title}`}
          >
            <MediaBox
              kind="video"
              src={`/img/${clip.id}`}
              alt={clip.title}
              size={TILE}
              fit="cover"
            />
            <span className={styles.remove} aria-hidden="true">
              <X className={styles.removeIcon} />
            </span>
          </button>
          <p className={styles.label}>{clipFacts(clip)}</p>
        </div>
      ))}

      {picked.length < max && (
        <div className={styles.item}>
          <button
            type="button"
            className={styles.add}
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-label="Pick a clip"
          >
            <Plus className={styles.addIcon} />
          </button>
          <p className={styles.addSpacer}>&nbsp;</p>
        </div>
      )}

      <span className={styles.count}>
        {picked.length}/{max}
      </span>

      <ClipPicker
        open={open}
        onOpenChange={setOpen}
        clips={clips}
        pickedIds={new Set(picked.map((c) => c.id))}
        onConfirm={onPick}
        max={max}
      />
    </div>
  )
}
