'use client'

import { useEffect, useRef } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Loader2,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExpandableIconButton,
} from '#/components'
import { imageUrl } from '#/lib/image-url'
import { cx } from '#/lib/utils'

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
 * **What it does borrow is the type scale**, deliberately: the prompt is
 * `--text-3xs` at 1.5 clamped to three lines exactly as `CardCaption` does,
 * and the model reads at that size too. Written by hand here, those drifted to
 * `--text-sm` and no model label at all, so a clip and a still read as different
 * kinds of record when they are the same row in the same table.
 *
 * **The player and both frames are one thumbnail, and the chrome sits on its
 * corners** (#534). This replaces the no-overlay-actions rule, which said the
 * file verbs had to be text in the caption because native controls own the
 * player's bottom edge and a second row of buttons above them is two sets of
 * controls arguing.
 *
 * Two things retired it, and both are consequences of changes already made:
 *
 * - **The unit's bottom corners are corners of the *frames*, not the player.**
 *   Treating the block as one thumbnail puts the player's bottom edge in the
 *   *middle* of the unit, so native controls appear where no chrome is and the
 *   collision the rule protected against cannot happen.
 * - **A card has controls only while it is playing** (#530), and only one card
 *   can be playing. Before that, every card carried a scrubber permanently.
 *
 * It holds in the one case worth checking: a pending or failed clip has no
 * frames block, so the corners land on the player -- but such a clip never
 * plays, so there are still no controls there. The frames exist exactly when
 * the clip is playable; the controls exist only while it plays. The two never
 * overlap.
 *
 * **Which is what Continue paid for.** It was the last frame itself (#530),
 * having been a caption text link before that (#494) -- and a picture with a
 * button embedded in its right half is exactly why nothing else could go
 * there. Moving it to the caption, beside the prompt, is what makes the block
 * a picture rather than a control, and the corners free. Read as a straight
 * reversal it looks like drift; it is not, because Continue is now buying the
 * whole unit's uniformity, which was not on the table when #530 chose the
 * frame.
 *
 * **Two markers on the picture, both always on**: `...` top-left and the
 * select tick bottom-left, which are the gallery card's own corners. The model
 * held the third until #536 and is now a fact in the caption -- at the density
 * #535 set, a label nearly half the card's width, sitting over a half-width end
 * frame, was the loudest thing on a card whose job is to show the clip.
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
 * **Continue sits beside the prompt, and it is still the one act that starts
 * new work** rather than acting on this row -- which is why it is on the
 * prompt's line and not in the `...` menu with Download and Delete.
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
 * **The tick is the only way to select.** The card does not become one big
 * toggle in select mode the way a still does: half of it is a player and the
 * other half is Continue, so a full-card click target would take Play and the
 * last frame away exactly when they still work.
 *
 * **Shape first, then duration, and no cost.** Shape is the fact that decides
 * whether two clips can cut together (#512) and it was the one thing about a
 * clip no surface showed. Cost came off: it is on every row of the Activity
 * log, which is where a spend question gets asked, and on a card it was
 * priced-per-item noise. The row is now only those two facts -- Download and
 * Delete left it for the menu -- so there is nothing here you might click.
 */
export function VideoThumb({
  video,
  isPlaying,
  onPlay,
  onDelete,
  onContinue,
  isContinuing,
  selected,
  selectionActive,
  onSelect,
}: {
  video: VideoRecord
  /** Whether this is the one card holding the page's playback. */
  isPlaying: boolean
  onPlay: (id: string) => void
  onDelete: (id: string) => void
  /** Absent while there is nothing to continue from -- see `isDone`. */
  onContinue: (video: VideoRecord) => void
  isContinuing: boolean
  /** Picked for a bulk action (#517). */
  selected: boolean
  /** Whether anything on the page is picked -- the unpicked cards say so with
   *  a greyed border, exactly as the gallery's do. */
  selectionActive: boolean
  onSelect: (id: string, shiftKey: boolean) => void
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
  const stage = ratio ? Math.min(Math.max(ratio, TALLEST), WIDEST) : 16 / 9
  const stageShape = { aspectRatio: String(stage) }
  /**
   * The two frames as one box, twice as wide as one of them.
   *
   * **On the strip, not on each frame.** Sized separately they each derive a
   * height from a fractional column width, and the two roundings disagree by a
   * pixel: the last frame rode a pixel high, and a hairline of card showed
   * under the first. One height, computed once, cannot disagree with itself.
   */
  const stripShape = { aspectRatio: String(stage * 2) }
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

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ExpandableIconButton
            icon={<MoreHorizontal className={styles.menuIcon} />}
            label="Clip actions"
          />
        }
      />
      <DropdownMenuContent align="start">
        {/* Finished clips only -- there is no file to fetch for one that does
            not exist yet. */}
        {isDone && (
          <DropdownMenuItem
            render={
              <a href={`/img/${video.id}`} download={`${video.id}.mp4`}>
                <Download />
                Download
              </a>
            }
          />
        )}
        {/* On every clip, not just finished ones: clearing a failure is the
            commonest reason to want it, and on a generating clip it is the
            only way to say stop. Last, and warming to danger on hover -- it
            moves the row to Trash rather than destroying it, so it is not red
            at rest. */}
        <DropdownMenuItem
          className={styles.destructive}
          onClick={() => onDelete(video.id)}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <article
      className={cx(
        styles.item,
        selected && styles.selectedItem,
        selectionActive && !selected && styles.selectableItem,
      )}
    >
      {/* **One thumbnail**: the player, the frame it opens on and the frame it
          stops at. The chrome below is positioned against this, not against
          the player -- which is what puts the player's controls in the middle
          of the unit and the chrome at its edges. */}
      <div className={styles.unit}>
        <div className={styles.stage}>
          {isDone ? (
            <>
              <video
                ref={player}
                className={styles.player}
                /* **The stage is the clip's own shape**, clamped -- see
                   `WIDEST`. Within the clamp there is nothing to letterbox and
                   nothing to crop, so the poster and the playing clip are the
                   same picture in the same box and pressing Play changes
                   nothing but the controls. */
                style={stageShape}
                src={`/img/${video.id}`}
                /* The real poster (#499), which is why there is no
                   `firstFrameSrc` here any more. Part of #500, on this surface
                   only. */
                poster={imageUrl(video.id, 'thumb')}
                /* Nothing is fetched until Play. A wall of clips used to pull
                   a header and a seek each on load; now it pulls an image the
                   row already has and no video at all. */
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
        </div>

        {/* Flush under the player, no gap and no edges: the three are one
            picture of the clip, and a gap anywhere in there makes them three
            things that happen to be stacked. Finished clips only -- there are
            no frames of a clip that does not exist yet, and a failed one has
            none at all.

            Plain pictures now. The last frame was Continue until #534; a
            button embedded in this block is what kept the unit's corners
            unusable. */}
        {isDone ? (
          <div className={styles.ends} style={stripShape}>
            <img
              className={styles.end}
              src={imageUrl(video.id, 'thumb')}
              alt="First frame"
              title="First frame"
            />
            {/* Held rather than collapsed when a clip predates the backfill:
                one frame across half the card would read as the clip having
                one end. Continue still works on such a clip -- `has_end_frame`
                says a *stored* frame is missing, not that there is nothing at
                the end. */}
            <img
              className={styles.end}
              src={video.has_end_frame ? imageUrl(video.id, 'end') : undefined}
              alt="Last frame"
              title="Last frame"
            />
          </div>
        ) : null}

        {/* Top-left, where the gallery card puts its own -- but always on,
            where a still's is hover-revealed. This is the only route to
            Download and Delete now, and a menu you have to hover to discover
            is one nobody discovers. See the stylesheet for the rest. */}
        <div className={styles.actions}>{menu}</div>

        {/* The one always-on marker left on the picture. The model label used
            to hold the opposite corner and came off in #536 -- see the
            stylesheet. */}
        <button
          type="button"
          className={cx(styles.selectTick, selected && styles.selectTickOn)}
          aria-pressed={selected}
          aria-label={selected ? 'Deselect clip' : 'Select clip'}
          onClick={(e) => onSelect(video.id, e.shiftKey)}
        >
          <CheckCircle2 className={styles.selectTickIcon} />
        </button>
      </div>

      <div className={styles.caption}>
        {/* Continue in the caption's top-right (#534, #537). The one act here
            that starts new work rather than acting on this row, which is why
            it is not in the menu -- and icon-only, because at three cards
            across the word was the only text competing with the prompt for
            its line. */}
        <div className={styles.promptRow}>
          <p className={styles.prompt}>{video.description}</p>
          {isDone ? (
            <button
              type="button"
              className={styles.continue}
              onClick={() => onContinue(video)}
              disabled={isContinuing}
              aria-label="Continue from this clip's last frame"
              title="Continue from the last frame"
            >
              {isContinuing ? (
                <Loader2 className={styles.spinner} size={12} />
              ) : (
                <ArrowUpRight size={12} />
              )}
            </button>
          ) : null}
        </div>

        {/* What the clip is, and what made it -- one row, nothing clickable.
            Shape and duration left, the model pushed to the right edge. */}
        <div className={styles.facts}>
          {shape ? <span className={styles.fact}>{shape}</span> : null}
          {duration ? <span className={styles.fact}>{duration}</span> : null}
          <span className={styles.model}>{video.title}</span>
        </div>
      </div>
    </article>
  )
}
