'use client'

import { useState } from 'react'
import { Plus, X, Youtube } from 'lucide-react'
import { YouTubeDialog } from '../youtube-dialog/youtube-dialog'
import { youTubeThumbnail } from '../../youtube'
import { ClipPicker } from '../../../_components/clip-picker/clip-picker'
import styles from './source-input.module.css'
import type { YouTubeSource } from '../../source'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { clipFacts } from '#/features/video/clip-facts'
import { MediaBox } from '#/components'

/** The strip's tile. Paired with `--tile` in the stylesheet: MediaBox takes a
 *  number, the row's geometry takes a length, and they have to agree. */
const TILE = 56

/**
 * What you are pulling frames out of: one tile, and the two ways to fill it.
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
 * **The tile swaps the source; it does not remove it.** Removing was the only
 * way back to the picker for a while, so every switch went through a state with
 * no player in it — the page collapsing to a plus button and then growing a
 * video back, twice, to change one clip. There is nothing a page like this
 * wants an empty stage for: once something is chosen there is always something,
 * and the choice outlives the visit.
 *
 * **Both ways in are always there, side by side** (#613). A YouTube video used
 * to replace the clip tile outright, so once a link was pasted the page offered
 * no route back to your own clips -- the row read as if YouTube were the only
 * source it had. The add tiles are labelled for the same reason: two dashed
 * squares say nothing about what they open. Picking either kind clears the
 * other; the slot holds one thing.
 *
 * `max` defaults to 1 and nothing here assumes it for clips: several clips
 * picked at once — to stitch, to compare — is a bigger number. That is the case
 * the X is for, where "no longer one of the ones I am working with" is a real
 * thing to say. A YouTube video is always exactly one.
 */
export function SourceInput({
  clips,
  picked,
  youtube,
  onPick,
  onPickYoutube,
  onRemove,
  max = 1,
  disabled,
}: {
  clips: Array<VideoRecord>
  picked: Array<VideoRecord>
  youtube: YouTubeSource | null
  onPick: (clips: Array<VideoRecord>) => void
  onPickYoutube: (videoId: string) => void
  onRemove: (id: string) => void
  max?: number
  disabled?: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [youtubeOpen, setYoutubeOpen] = useState(false)

  // With one slot the tile is the way back to the picker, so removing has
  // nothing to offer: there is no state where no clip is the answer.
  const removable = max > 1

  return (
    <div className={styles.root}>
      {youtube && (
        <div className={styles.item}>
          <button
            type="button"
            className={styles.frame}
            onClick={() => setYoutubeOpen(true)}
            disabled={disabled}
            aria-label="Change video"
          >
            {/* A plain `<img>`, not `MediaBox`: this is a still on another
                origin, and MediaBox exists to choose between a poster and a
                media element for objects we serve ourselves. */}
            <img
              className={styles.thumbnail}
              src={youTubeThumbnail(youtube.videoId)}
              alt={youtube.title}
              draggable={false}
            />
          </button>
          <p className={styles.label}>{youtube.title}</p>
        </div>
      )}

      {picked.map((clip) => (
        <div key={clip.id} className={styles.item}>
          <button
            type="button"
            className={styles.frame}
            onClick={() =>
              removable ? onRemove(clip.id) : setPickerOpen(true)
            }
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
            {/* The marker, not the target -- the tile takes the click and
                this says what it does. Only where removing is a thing to
                do. */}
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
            onClick={() => setPickerOpen(true)}
            disabled={disabled}
            aria-label="Pick a clip from this app"
          >
            <Plus className={styles.addIcon} />
          </button>
          <p className={styles.addLabel}>Your clips</p>
        </div>
      )}

      <div className={styles.item}>
        <button
          type="button"
          className={styles.add}
          onClick={() => setYoutubeOpen(true)}
          disabled={disabled}
          aria-label="Pull frames from a YouTube video"
        >
          <Youtube className={styles.addIcon} />
        </button>
        <p className={styles.addLabel}>YouTube</p>
      </div>

      {!youtube && (
        <span className={styles.count}>
          {picked.length}/{max}
        </span>
      )}

      <ClipPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clips={clips}
        pickedIds={new Set(picked.map((c) => c.id))}
        onConfirm={onPick}
        max={max}
      />

      <YouTubeDialog
        open={youtubeOpen}
        onOpenChange={setYoutubeOpen}
        onPick={onPickYoutube}
      />
    </div>
  )
}
