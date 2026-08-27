'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ClipPicker } from '../../../_components/clip-picker/clip-picker'
import { clipFacts } from '../../../_components/clip-facts'
import styles from './clip-input.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { MediaBox } from '#/components'

/** The strip's tile. Paired with `--tile` in the stylesheet: MediaBox takes a
 *  number, the row's geometry takes a length, and they have to agree. */
const TILE = 56

/**
 * The clip you are working with: one tile, and the picker behind it.
 *
 * **`RefImageStrip`'s geometry with a clip in the slot** — the same 3.5rem
 * tile, the same dashed add square, the same n/max counter at the end, because
 * choosing a clip should feel like choosing a reference image. It is not that
 * component: the strip renders an `<img>`, and no surface reads a clip's
 * poster frame yet -- ingest has written one since #499, but switching the
 * tiles over is #500 -- so the filled slot has to be a `MediaBox`.
 *
 * A scrolling row of every clip was the first version of this, and it is fine
 * at eleven clips and useless at five hundred. A dialog is the thing that
 * scales, and the app already picks images that way.
 *
 * **The tile swaps the clip; it does not remove it.** Removing was the only way
 * back to the picker for a while, so every switch went through a state with no
 * player in it — the page collapsing to a plus button and then growing a video
 * back, twice, to change one clip. There is nothing a page like this wants an
 * empty stage for: once a clip is chosen there is always one, and the choice
 * outlives the visit.
 *
 * `max` defaults to 1 and nothing here assumes it: several clips picked at once
 * — to stitch, to compare — is a bigger number. That is the case the X is for,
 * where "no longer one of the ones I am working with" is a real thing to say.
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

  // With one slot the tile is the way back to the picker, so removing has
  // nothing to offer: there is no state where no clip is the answer.
  const removable = max > 1

  return (
    <div className={styles.root}>
      {picked.map((clip) => (
        <div key={clip.id} className={styles.item}>
          <button
            type="button"
            className={styles.frame}
            onClick={() => (removable ? onRemove(clip.id) : setOpen(true))}
            disabled={disabled}
            aria-label={removable ? `Remove ${clip.title}` : 'Change clip'}
          >
            {/* `contain` here for the same reason the picker uses it: the
                tile should look like the clip you chose, not a crop of it. */}
            <MediaBox
              kind="video"
              src={`/img/${clip.id}`}
              alt={clip.title}
              size={TILE}
              fit="contain"
              pad={0}
            />
            {/* The marker, not the target -- the tile takes the click and this
                says what it does. Only where removing is a thing to do. */}
            {removable && (
              <span className={styles.remove} aria-hidden="true">
                <X className={styles.removeIcon} />
              </span>
            )}
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
