'use client'

import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Loader2,
  Trash2,
} from 'lucide-react'
import styles from './video-thumb.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { firstFrameSrc } from '#/components'
import { aspectLabel, aspectRatio } from '#/features/video/clip-facts'
import { imageUrl } from '#/lib/image-url'

function durationOf(video: VideoRecord): string | null {
  const seconds = (video.generation_metadata ?? {}).duration_seconds
  return typeof seconds === 'number' ? `${seconds}s` : null
}

/**
 * One clip: the player, the model on it, the prompt under it.
 *
 * **Its own component rather than `Thumbnail`, and the difference is the
 * `<video>`.** A clip is not a picture with a play button -- it has a duration
 * and native controls, so the element itself paints frame one. Bending
 * `Thumbnail` around that would put a media element inside the primitive every
 * still in the app renders through, to serve one route.
 *
 * Ingest has written a real poster frame for every clip since #499 and nothing
 * here reads it; #500 is the switchover, and it has to keep this path for the
 * clips made before it that were never backfilled.
 *
 * **What it does borrow is the type scale**, deliberately: the model badge is
 * `--text-3xs` in the picture's bottom-right corner exactly as `Thumbnail`
 * draws it, and the prompt below is `--text-3xs` at 1.5 clamped to three lines
 * exactly as `CardCaption` does. Written by hand here, those two drifted to
 * `--text-sm` and no badge at all, so a clip and a still read as different
 * kinds of record when they are the same row in the same table.
 *
 * **No overlay actions on the player.** A still hides Download and `...` until
 * hover because the picture is the thing and the chrome is in the way; a clip
 * already has native controls sitting over its bottom edge, and a second set of
 * buttons above them is two rows of controls arguing. So the file verbs live in
 * the caption as text, where they cannot collide with the scrubber.
 *
 * That rule is about the *player*, and the frames below it are not one. They
 * have no controls to argue with, which is why Continue can live on one.
 *
 * **The last frame is Continue** -- the picture is the control, not a text link
 * beside it. Continue takes the frame at the end of this clip and puts it in
 * the form; pointing at that frame and clicking is the same sentence as the
 * verb was, minus the verb. It was `CornerDownRight` plus the word in the
 * caption (#494), which was a line of `--text-3xs` text against a target that
 * is now half a card.
 *
 * It stays the one act on this card that starts new work rather than acting on
 * this row, which is exactly why it is not down among Download and Delete.
 *
 * **The player and both frames are one block**, flush, half the card each. The
 * player is kept -- watching the clip is most of what this card is for, and a
 * pair of stills cannot replace it -- and the frames are the two it is worst at
 * showing: the one it opens on and the one it stops at, which is the frame the
 * next clip has to start from.
 *
 * They deliberately do *not* use `ClipFrames`, which the lab's run and picker
 * share. That draws frame one as a `<video>` because a lab tile has no player
 * of its own; here there is one directly above, and a second media element per
 * card across a wall of clips is a real cost for a picture the row can already
 * serve as an `<img>` from `thumbnail_path` (#499).
 *
 * **Shape first, then duration, and no cost** -- at the left edge, at full
 * strength rather than the muted grey the verbs use. Shape is the fact that
 * decides whether two clips can cut together (#512) and it was the one thing
 * about a clip no surface showed. Cost came off: it is on every row of the
 * Activity log, which is where a spend question gets asked, and on a card it
 * was priced-per-item noise next to a Download button.
 */
export function VideoThumb({
  video,
  onDelete,
  onContinue,
  isContinuing,
}: {
  video: VideoRecord
  onDelete: (id: string) => void
  /** Absent while there is nothing to continue from -- see `isDone`. */
  onContinue: (video: VideoRecord) => void
  isContinuing: boolean
}) {
  const duration = durationOf(video)
  const ratio = aspectRatio(video)
  const shape = aspectLabel(ratio)
  /* The clip's own shape, so the frames below are edge-to-edge. 16:9 only when
     the row does not know -- a poster that never decoded (#499) -- where a
     guess is better than a frame with no box at all. */
  const endShape = { aspectRatio: ratio ? String(ratio) : '16 / 9' }
  const isDone = video.status === 'completed'

  return (
    <article className={styles.item}>
      <div className={styles.stage}>
        {isDone ? (
          <video
            className={styles.player}
            src={firstFrameSrc(`/img/${video.id}`)}
            controls
            preload="metadata"
            playsInline
          />
        ) : video.status === 'failed' ? (
          <div className={styles.state}>
            <AlertTriangle size={16} />
            <span>{video.generation_error ?? 'Generation failed'}</span>
          </div>
        ) : (
          <div className={styles.state}>
            <Loader2 className={styles.spinner} size={16} />
            <span>Generating…</span>
          </div>
        )}

        {/* The model, on the picture, same corner and same size as a still's
            (#367). It names what made this clip, so it belongs to the clip --
            and a badge that moved between the two surfaces would be the one
            label you track across a generation moving on you. Lifted clear of
            the native controls, which own the bottom edge. */}
        <span className={styles.badge}>{video.title}</span>
      </div>

      {/* Flush under the player, no gap and no edges: the player, the frame it
          opens on and the frame it ends on are one picture of the clip, and a
          gap anywhere in there makes them three things that happen to be
          stacked. Finished clips only -- there are no frames of a clip that
          does not exist yet, and a failed one has none at all. */}
      {isDone ? (
        <div className={styles.ends}>
          <img
            className={styles.end}
            style={endShape}
            src={imageUrl(video.id, 'thumb')}
            alt="First frame"
            title="First frame"
          />
          {/* The last frame *is* Continue. The verb was a text link in the
              caption; what it actually does is take this picture and put it in
              the form, so the picture is the control -- and at half a card it
              is a far bigger target than a line of `--text-3xs` text.

              Held rather than collapsed when a clip predates the backfill: one
              frame across half the card reads as the clip having one end. It
              is still the button, because the frame can still be read out of
              the clip -- `has_end_frame` says a stored one is missing, not
              that there is nothing at the end. */}
          <button
            type="button"
            className={styles.continue}
            onClick={() => onContinue(video)}
            disabled={isContinuing}
            aria-label="Continue from this clip's last frame"
            title="Continue from the last frame"
          >
            <img
              className={styles.end}
              style={endShape}
              src={video.has_end_frame ? imageUrl(video.id, 'end') : undefined}
              alt=""
            />
            {/* Always on the picture, not on hover: it is the only thing saying
                this frame does something, and a card you have to touch to
                discover is one nobody discovers. Lower-left, which is the one
                corner nothing else on this card uses -- the model badge holds
                top-right of the player. */}
            <span className={styles.continueBadge}>
              {isContinuing ? (
                <Loader2 className={styles.spinner} size={12} />
              ) : (
                <ArrowUpRight size={12} />
              )}
            </span>
          </button>
        </div>
      ) : null}

      <div className={styles.caption}>
        <p className={styles.prompt}>{video.description}</p>
        {/* Finished clips only: there is no last frame of a clip that does not
            exist yet, and a failed one has no frames at all. */}
        <div className={styles.facts}>
          {shape ? <span className={styles.fact}>{shape}</span> : null}
          {duration ? <span className={styles.fact}>{duration}</span> : null}
          <span className={styles.spacer} />
          {isDone ? (
            <a
              className={styles.action}
              href={`/img/${video.id}`}
              download={`${video.id}.mp4`}
            >
              <Download size={12} />
              Download
            </a>
          ) : null}
          {/* On every clip, not just finished ones: clearing a failure is the
              commonest reason to want it, and on a generating clip it is the
              only way to say stop. */}
          <button
            type="button"
            className={styles.destructive}
            onClick={() => onDelete(video.id)}
            aria-label="Delete clip"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}
