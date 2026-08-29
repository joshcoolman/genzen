'use client'

import { useEffect, useRef } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Loader2,
  Play,
  Trash2,
} from 'lucide-react'
import styles from './video-thumb.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import {
  aspectLabel,
  aspectRatio,
  namedRatio,
} from '#/features/video/clip-facts'
import { imageUrl } from '#/lib/image-url'

/**
 * How far the stage may go, as ratios.
 *
 * The stage takes the clip's own shape, so nothing is cropped or barred -- but
 * `VideoList` is a grid, and grid rows are as tall as their tallest card. Left
 * unbounded a portrait clip is a card three times the height of the 21:9 one
 * beside it, and every short card in that row sits over dead space.
 *
 * Clamping keeps the raggedness to the range real horizontal shapes occupy:
 * 21:9 through 4:3 is about 100px of stage at a 20rem column. Anything outside
 * it -- a portrait clip, an ultrawide one -- lands on the nearest bound and is
 * centred inside it by `object-fit: contain`, which is the standard box a
 * vertical clip wants anyway.
 */
const WIDEST = 21 / 9
const TALLEST = 4 / 3

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
 * **The player has no controls until it is played.** A poster, one play button,
 * and nothing else -- a grid of cards was five sets of scrubbers, timecodes and
 * overflow menus competing with five pictures, and the pictures are what the
 * page is for. Pressing Play hands the card to the native controls and they
 * stay, sticky rather than on hover: chrome that follows the pointer flickers
 * across a grid, and a scrubber has to stay put while it is being used.
 *
 * **Which card that is belongs to the page, not to this component** -- see
 * `isPlaying`. Playing one clip rewinds and un-engages whatever was playing
 * before, so a page of clips cannot end up as six of them talking at once.
 *
 * The real win is not visual. `poster` plus `preload="none"` means a card
 * fetches an image the row already has and no video at all until asked.
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
  isPlaying,
  onPlay,
  onDelete,
  onContinue,
  isContinuing,
}: {
  video: VideoRecord
  /** Whether this is the one card holding the page's playback. */
  isPlaying: boolean
  onPlay: (id: string) => void
  onDelete: (id: string) => void
  /** Absent while there is nothing to continue from -- see `isDone`. */
  onContinue: (video: VideoRecord) => void
  isContinuing: boolean
}) {
  const duration = durationOf(video)
  /* Snapped to the shape it reads as, not the exact rectangle FAL returned.
     One 21:9 request comes back as both 1504x672 and 1568x672; sized from the
     raw ratio, two cards captioned `21:9` sat at different heights beside each
     other while every other part of the app called them one shape. */
  const ratio = namedRatio(aspectRatio(video))
  const shape = aspectLabel(ratio)
  /* 16:9 when the row does not know its shape -- a poster that never decoded
     (#499), or a clip that has not been made yet. */
  const stageShape = {
    aspectRatio: String(
      ratio ? Math.min(Math.max(ratio, TALLEST), WIDEST) : 16 / 9,
    ),
  }
  /* The clip's own shape, so the frames below are edge-to-edge. 16:9 only when
     the row does not know -- a poster that never decoded (#499) -- where a
     guess is better than a frame with no box at all. */
  const endShape = { aspectRatio: ratio ? String(ratio) : '16 / 9' }
  const isDone = video.status === 'completed'

  /**
   * **One clip plays at a time, and the page owns which.** `isPlaying` is the
   * only thing that puts native controls on this card, so a card that loses it
   * goes back to a poster and a play button -- there is no way to end up with
   * six scrubbers on screen, because there is no way to have two cards
   * engaged.
   *
   * Sticky within the card, not tied to hover: controls that come and go with
   * the pointer flicker their way across a grid, and a scrubber has to stay
   * put while it is being used. Pausing with the native controls keeps the
   * card engaged -- only another card's Play takes it away.
   */
  const player = useRef<HTMLVideoElement>(null)

  /**
   * Rewind on the way out, so a card that lost playback is at its first frame
   * next time rather than halfway through.
   *
   * Guarded on having actually been playing, rather than run whenever
   * `isPlaying` is false. Touching `currentTime` on a `preload="none"` element
   * that has never loaded would ask the browser to fetch the clip, which is
   * the one thing the poster is there to avoid.
   */
  const wasPlaying = useRef(false)

  useEffect(() => {
    if (wasPlaying.current && !isPlaying) {
      const el = player.current
      if (el) {
        el.pause()
        el.currentTime = 0
      }
    }
    wasPlaying.current = isPlaying
  }, [isPlaying])

  return (
    <article className={styles.item}>
      <div className={styles.stage}>
        {isDone ? (
          <>
            <video
              ref={player}
              className={styles.player}
              /* **The stage is the clip's own shape**, clamped -- see `WIDEST`.
                 Within the clamp there is nothing to letterbox and nothing to
                 crop, so the poster and the playing clip are the same picture
                 in the same box and pressing Play changes nothing but the
                 controls. Outside it, `contain` centres the clip in the nearest
                 allowed box, which is what a portrait clip wants. */
              style={stageShape}
              src={`/img/${video.id}`}
              /* The real poster (#499), which is why there is no
                 `firstFrameSrc` here any more: the `#t=0.001` seek existed to
                 make a `<video>` paint frame one when nothing else could, and
                 `poster` does it from an image. Part of #500, on this surface
                 only. */
              poster={imageUrl(video.id, 'thumb')}
              /* Nothing is fetched until Play. A wall of clips used to pull a
                 header and a seek each on load; now it pulls an image the row
                 already has and no video at all. */
              preload="none"
              controls={isPlaying}
              playsInline
            />
            {!isPlaying ? (
              <button
                type="button"
                className={styles.play}
                onClick={() => {
                  onPlay(video.id)
                  void player.current?.play()
                }}
                aria-label="Play this clip"
              >
                <Play size={20} />
              </button>
            ) : null}
          </>
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
