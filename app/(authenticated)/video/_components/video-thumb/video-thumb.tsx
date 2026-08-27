'use client'

import {
  AlertTriangle,
  CornerDownRight,
  Download,
  Loader2,
  Trash2,
} from 'lucide-react'
import styles from './video-thumb.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { firstFrameSrc } from '#/components'
import { clipDurationSeconds, formatCost } from '#/features/video/models'

function costOf(video: VideoRecord): string | null {
  const cents = (video.generation_metadata ?? {}).provider_cost_cents
  return typeof cents === 'number' ? formatCost(cents) : null
}

function durationOf(video: VideoRecord): string | null {
  const seconds = clipDurationSeconds(video)
  return seconds != null ? `${seconds}s` : null
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
 * **No overlay actions.** A still hides Download and `...` until hover because
 * the picture is the thing and the chrome is in the way; a clip already has
 * native controls sitting over its bottom edge, and a second set of buttons
 * above them is two rows of controls arguing. So the verbs live in the caption
 * as text, where they cannot collide with the scrubber.
 *
 * **Continue sits above the rule, on its own** (#494). It is the one verb here
 * that starts new work rather than acting on this row -- Download and Delete
 * are about the clip in front of you, Continue is about the next one -- so it
 * reads as a separate act instead of the third item in a row of file
 * operations. The facts moved to the right of that row at the same time, which
 * is what leaves the left edge to it.
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
  const cost = costOf(video)
  const duration = durationOf(video)
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

      <div className={styles.caption}>
        <p className={styles.prompt}>{video.description}</p>
        {/* Finished clips only: there is no last frame of a clip that does not
            exist yet, and a failed one has no frames at all. */}
        {isDone ? (
          <button
            type="button"
            className={styles.continue}
            onClick={() => onContinue(video)}
            disabled={isContinuing}
          >
            {isContinuing ? (
              <Loader2 className={styles.spinner} size={12} />
            ) : (
              <CornerDownRight size={12} />
            )}
            {isContinuing ? 'Reading last frame\u2026' : 'Continue'}
          </button>
        ) : null}
        <div className={styles.facts}>
          <span className={styles.spacer} />
          {duration ? <span>{duration}</span> : null}
          {cost ? <span>{cost}</span> : null}
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
