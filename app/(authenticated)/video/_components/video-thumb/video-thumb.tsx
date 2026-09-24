'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Download,
  EyeOff,
  Grid3x3,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react'
import styles from './video-thumb.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import {
  aspectLabel,
  aspectRatio,
  clipModel,
  clipName,
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
import { useHoldToPlay } from '#/lib/use-hold-to-play'
import { useModifierHeld } from '#/lib/use-modifier-held'
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

/** A poster and end frames for scanning; a click opens the page's player, and
 *  a press held plays the clip on the card until it ends (#726). */
export function VideoThumb({
  video,
  onPlay,
  onDelete,
  onHide,
  onContinue,
  onGrabFrames,
  onRename,
  isContinuing,
  selected,
  selectionActive,
  onSelect,
}: {
  video: VideoRecord
  onPlay: (id: string) => void
  onDelete: (id: string) => void
  /** Take it off the wall without destroying it (#537). What the corner icon
   *  does; Trash moves behind Cmd on the same button. */
  onHide: (id: string) => void
  /** Absent while there is nothing to continue from -- see `isDone`. */
  onContinue: (video: VideoRecord) => void
  /** Open the contact sheet of stills for this clip (#647). Finished clips
   *  only -- there are no frames of a clip that does not exist yet. */
  onGrabFrames: (video: VideoRecord) => void
  /** Open the naming dialog for this clip (#657). */
  onRename: (video: VideoRecord) => void
  isContinuing: boolean
  /** Picked for a bulk action (#517). */
  selected: boolean
  /** Whether anything on the page is picked -- the unpicked cards say so with
   *  a greyed border, exactly as the gallery's do. */
  selectionActive: boolean
  onSelect: (id: string, shiftKey: boolean) => void
}) {
  const duration = durationOf(video)
  const name = clipName(video)
  /* Snapped to the shape it reads as, not the exact rectangle FAL returned.
     One 21:9 request comes back as both 1504x672 and 1568x672; sized from the
     raw ratio, two cards captioned `21:9` sat at different heights beside each
     other while every other part of the app called them one shape. */
  const ratio = namedRatio(aspectRatio(video))
  const shape = aspectLabel(ratio)
  /* 16:9 when the row does not know its shape -- a poster that never decoded
     (#499), or a clip that has not been made yet. */
  const hold = useHoldToPlay()
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
        {/* Pulling reference stills out of a clip we already own. Here rather
            than on the card, because it opens a surface to work in -- the
            card's own buttons are the acts that change this row or start the
            next generation. */}
        {isDone && (
          <DropdownMenuItem onClick={() => onGrabFrames(video)}>
            <Grid3x3 />
            Grab frames
          </DropdownMenuItem>
        )}
        {/* On every clip: a clip generating is exactly when you know what it
            is meant to be, and a name is the one thing here that does not
            depend on the file existing. */}
        <DropdownMenuItem onClick={() => onRename(video)}>
          <Pencil />
          {name ? 'Rename' : 'Name this clip'}
        </DropdownMenuItem>
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
            <button
              type="button"
              className={styles.openPlayer}
              onClick={() => {
                // The click that ends a hold is the hold ending, not a
                // request for the dialog.
                if (!hold.consumeHold()) onPlay(video.id)
              }}
              {...hold.handlersFor(video.id)}
              aria-label="Play this clip"
              aria-haspopup="dialog"
            >
              <img
                className={styles.player}
                style={stageShape}
                src={imageUrl(video.id, 'thumb')}
                alt=""
                loading="lazy"
              />
              {/* Over the poster in the poster's box, `cover` like it, gone
                  on release. Sound on, as the dialog's is. */}
              {hold.playingId === video.id ? (
                <video
                  className={styles.preview}
                  src={imageUrl(video.id)}
                  autoPlay
                  loop
                  playsInline
                />
              ) : (
                <span className={styles.play} aria-hidden="true">
                  <Play size={20} />
                </span>
              )}
            </button>
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

        {/* Top-right, the corner #536 emptied (#537). Hide by default, Trash
            under Cmd -- see `CornerAction`. Carried over from the gallery card
            unchanged, because the reasoning is unchanged: trashing was the
            path of least resistance for tidying a wall because it was the only
            one-click thing on it, and a clip is expensive enough that the ease
            belongs to the safe verb. */}
        <div className={styles.cornerAction}>
          <CornerAction id={video.id} onHide={onHide} onDelete={onDelete} />
        </div>

        {/* **In select mode the whole picture is the target**, as a still's
            whole tile is (#538). Only in select mode: with nothing picked,
            Play and Continue own their halves and a card-wide target would
            take both away.

            **No exception for a playing clip**, because there cannot be one:
            entering select mode stops playback (`use-view`), so every card
            here is a poster and a tick. It carried that exception briefly and
            it read on the wall as one tile behaving unlike its neighbours.

            `tabIndex={-1}` because the tick already carries this card's
            keyboard route in; two stops for one act is one too many. */}
        {selectionActive ? (
          <button
            type="button"
            tabIndex={-1}
            className={styles.selectOverlay}
            aria-label={selected ? 'Deselect clip' : 'Select clip'}
            onClick={(e) => onSelect(video.id, e.shiftKey)}
          />
        ) : null}

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
        {/* The name, above the prompt and only once there is one (#657). A
            clip is born called after the model that made it, and printing that
            here would put the same words on two lines of every card. */}
        {name ? <p className={styles.name}>{name}</p> : null}

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
          <span className={styles.model}>{clipModel(video)}</span>
        </div>
      </div>
    </article>
  )
}

/**
 * One icon in the picture's top-right corner, two verbs (#504, #537).
 *
 * The gallery card's `CornerAction`, carried over rather than shared: the two
 * are ~30 lines each over different row types, and a shared one would have to
 * decide for both surfaces -- which is how `image-detail` got imposed on a
 * plain viewer. What is worth keeping identical is the *behaviour*, and it is
 * written down in both places.
 *
 * **A second icon was the thing to avoid.** A row of them in a card corner is
 * more to mis-click, and the mis-click that matters is the destructive one.
 * Under this shape the accidental press is recoverable in one click and the
 * destructive press takes a modifier. The `...` menu keeps a plain Delete for
 * anyone who does not know the modifier exists, and both are listed at
 * `/account/shortcuts` (#289).
 *
 * `useModifierHeld` is tracked only while this button is hovered, per its own
 * warning: a wall draws dozens of these, and a permanent key listener each is
 * a cost that stays invisible until the wall is long. `seed(e)` on mouse-enter
 * covers the key already being down before the pointer arrived.
 */
function CornerAction({
  id,
  onHide,
  onDelete,
}: {
  id: string
  onHide: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const { meta, seed } = useModifierHeld(hovered)

  return (
    <ExpandableIconButton
      icon={
        meta ? (
          <Trash2 className={styles.menuIcon} />
        ) : (
          <EyeOff className={styles.menuIcon} />
        )
      }
      label={meta ? 'Delete' : 'Hide'}
      variant={meta ? 'destructive' : 'default'}
      onMouseEnter={(e) => {
        setHovered(true)
        seed(e)
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) onDelete(id)
        else onHide(id)
      }}
    />
  )
}
