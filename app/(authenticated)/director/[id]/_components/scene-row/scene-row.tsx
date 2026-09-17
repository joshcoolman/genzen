'use client'

import { Film, Pencil, Play, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { frameState, lineToSpeak, sectionCostCents } from '../../board'
import styles from './scene-row.module.css'
import type { FrameState } from '../../board'
import type { FrameStatus } from '../../use-storyboard'
import type { RefAsset } from '../../../_actions/references.action'
import type { BoardScene } from '../../../_lib/types'
import {
  Button,
  ExpandableText,
  MiniButton,
  Skeleton,
  Textarea,
} from '#/components'
import { formatCost } from '#/features/video/models'
import { imageUrl } from '#/lib/image-url'

/**
 * One scene of a storyboard (#695): what it says, and the two frames it runs
 * between.
 *
 * **A scene is one numbered line of the script**, and the two frames are the
 * ends of the video section that line will become -- which is why the seconds
 * sit beside them. Five seconds is a breath between the two pictures; twelve is
 * a move across the room.
 *
 * **Large, and side by side, because the row is the judgement.** The question
 * this tab answers is whether the scenes read top to bottom as a story worth
 * watching, and that is answered by looking -- so the frames are as big as the
 * column allows and the opening sits directly beside the closing. `ClipFrames`
 * is the visual precedent, a clip's first and last frame in one tile, but it
 * takes a clip and squares both halves; these are two arbitrary rows at the
 * shape every frame is generated in.
 *
 * **The gap inside a pair is tighter than the gap between rows.** Two frames of
 * one scene are its ends; two rows are a cut. A column where those read the
 * same is a wall of stills with no structure in it -- the run's tile row
 * learned this first (#512).
 */
/** What a failed row said, or null. Indexed access is unchecked by the
 *  compiler here, so the lookup is guarded by hand rather than with `?.`. */
function errorOf(
  frames: Record<string, RefAsset>,
  id: string | null,
): string | null {
  if (!id) return null
  return id in frames ? frames[id].generation_error : null
}

export function SceneRow({
  scene,
  status,
  frames,
  filming,
  retrying,
  onRerun,
  onRetry,
  onFilm,
  onWatch,
  onDropTake,
  onEditLine,
}: {
  scene: BoardScene
  status: FrameStatus
  /** The rows themselves, for what a failed one said. */
  frames: Record<string, RefAsset>
  /** A section is in flight for this row, so a second press is refused rather
   *  than quietly bought. */
  filming: boolean
  /** A frame of this row is being asked for again. */
  retrying: boolean
  onRerun: (scene: BoardScene) => void
  onRetry: (scene: BoardScene, which: 'opening' | 'closing') => void
  onFilm: (scene: BoardScene) => void
  onWatch: (takeId: string) => void
  onDropTake: (scene: BoardScene, takeId: string) => void
  onEditLine: (scene: BoardScene, spoken: string) => void
}) {
  /* The opening frame is what a section starts from, so there is nothing to
     generate until it exists. */
  const ready = frameState(scene.openingId, status) === 'completed'
  return (
    <li className={styles.scene}>
      <div className={styles.meta}>
        {/* The number and the seconds are the Script tab's, printed the same
            way: the board is one row per line, so the two have to agree at a
            glance. */}
        <p className={styles.facts}>
          <span className={styles.number}>{scene.number}</span>
          {scene.seconds === null ? null : <span>{scene.seconds}s</span>}
        </p>
        {/* **What this scene will say, edited here.** The board is where a
            script is made ready to shoot: a line that would be refused for
            naming a trademarked work, or mispronounced, is cheapest to fix
            before anything is generated rather than at the moment of spending.
            So the working text leads and the script sits under it when the two
            differ -- `scene.line` is never written, and retyping it clears the
            override. */}
        <SceneLine
          scene={scene}
          onSave={(spoken) => onEditLine(scene, spoken)}
        />
        {/* What was typed into the last re-run, so the row says what it was
            asked for rather than leaving a changed frame unexplained. */}
        {scene.guidance && <p className={styles.guidance}>{scene.guidance}</p>}
        <MiniButton
          icon={<RefreshCw className={styles.icon} />}
          onClick={() => onRerun(scene)}
        >
          Rerun with guidance
        </MiniButton>

        {/* The row's second act (#697): the frames were the spec, this is the
            clip. The price is on the control, because the button is on every
            row and thirty-two of them is the bill the board exists to avoid. */}
        <MiniButton
          icon={<Film className={styles.icon} />}
          spinning={filming}
          disabled={!ready || filming}
          onClick={() => onFilm(scene)}
        >
          Generate video · {formatCost(sectionCostCents(scene.seconds))}
        </MiniButton>
      </div>

      <div className={styles.frames}>
        <Frame
          id={scene.openingId}
          state={frameState(scene.openingId, status)}
          label="Opens on"
          alt={`Scene ${scene.number}, opening frame`}
          message={errorOf(frames, scene.openingId)}
          retrying={retrying}
          onRetry={() => onRetry(scene, 'opening')}
        />
        <Frame
          id={scene.closingId}
          state={frameState(scene.closingId, status)}
          label="Ends on"
          alt={`Scene ${scene.number}, closing frame`}
          message={errorOf(frames, scene.closingId)}
          retrying={retrying}
          onRetry={() => onRetry(scene, 'closing')}
          /* The closing frame is generated from the opening one, so before that
             lands there is nothing to derive from and nothing has been asked
             for. Saying so is the difference between a queue and a hole. */
          waitingOn={
            scene.closingId === null &&
            frameState(scene.openingId, status) !== 'completed'
          }
        />
      </div>

      {/* The takes of this section, under the pair they were generated from and
          across the full width of the row.

          **A grid of pictures rather than a row of chips.** Takes add rather
          than replace, so the reason they exist is to be compared -- and two
          candidates you cannot see side by side are two things you have to
          remember. Four across, because a take is a 16:9 frame and four of them
          still read at this width. Nothing here is marked as the one: choosing
          a take per row is what turns the board into a cut, and that is its own
          decision. */}
      {scene.videoIds.length > 0 && (
        <ol className={styles.takes}>
          {scene.videoIds.map((takeId, index) => (
            <Take
              key={takeId}
              id={takeId}
              number={index + 1}
              state={frameState(takeId, status)}
              message={errorOf(frames, takeId)}
              onWatch={() => onWatch(takeId)}
              onDrop={() => onDropTake(scene, takeId)}
            />
          ))}
        </ol>
      )}
    </li>
  )
}

/**
 * The line, and the press that edits it.
 *
 * Its own component for its own draft state: a row that held the draft would
 * lose it to the poll's refresh, which lands every few seconds while a section
 * is being made.
 */
function SceneLine({
  scene,
  onSave,
}: {
  scene: BoardScene
  onSave: (spoken: string) => void
}) {
  const said = lineToSpeak(scene)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(said)

  if (editing) {
    return (
      <div className={styles.editor}>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          autoFocus
        />
        <div className={styles.editorFoot}>
          <Button
            size="sm"
            variant="primary"
            disabled={!draft.trim()}
            onClick={() => {
              onSave(draft)
              setEditing(false)
            }}
          >
            Save
          </Button>
          <Button size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <p className={styles.line}>{said}</p>
      {/* The film's own words, when the take is set to say something else. Kept
          visible so a rewording is a divergence you can see rather than a
          quiet overwrite. */}
      {scene.spokenLine && (
        <p className={styles.spoken}>Script: {scene.line}</p>
      )}
      <MiniButton
        icon={<Pencil className={styles.icon} />}
        onClick={() => {
          setDraft(said)
          setEditing(true)
        }}
      >
        Edit line
      </MiniButton>
    </>
  )
}

/** One take: its own first frame, and a press to watch it. */
function Take({
  id,
  number,
  state,
  message,
  onWatch,
  onDrop,
}: {
  id: string
  number: number
  state: FrameState
  /** What the provider said, when it refused. */
  message: string | null
  onWatch: () => void
  onDrop: () => void
}) {
  const done = state === 'completed'

  return (
    <li className={styles.take}>
      <button
        type="button"
        className={styles.takeBox}
        disabled={!done}
        onClick={onWatch}
      >
        {done ? (
          <>
            {/* The clip's own poster, extracted when it settled -- an `<img>`
                rather than a `<video>` because a board holding thirty-two
                elements decoding at once is a board you cannot scroll. */}
            <img
              className={styles.image}
              src={imageUrl(id, 'thumb')}
              alt={`Take ${number}`}
            />
            <span className={styles.play}>
              <Play className={styles.playIcon} />
            </span>
          </>
        ) : state === 'failed' ? (
          /* The provider's own words, which for a take are usually worth
             reading: Kling refuses on content grounds by answering COMPLETED
             to a status check and 422 to the result, and its message is the
             only account of why. */
          <span className={styles.takeNote}>
            {message ?? 'This take did not come back.'}
          </span>
        ) : (
          <Skeleton className={styles.pending} />
        )}
      </button>
      <p className={styles.caption}>
        Take {number}
        {state === 'pending' && ' · working'}
        {/* Takes add, so something has to subtract: a refused take would
            otherwise sit on the row for the life of the board. Trash, like
            everything else here. */}
        {state === 'failed' && (
          <button type="button" className={styles.drop} onClick={onDrop}>
            Remove
          </button>
        )}
      </p>
    </li>
  )
}

function Frame({
  id,
  state,
  label,
  alt,
  waitingOn = false,
  message,
  retrying,
  onRetry,
}: {
  id: string | null
  state: FrameState
  label: string
  alt: string
  waitingOn?: boolean
  /** What the provider said, shown under the neutral line rather than as it. */
  message: string | null
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <figure className={styles.frame}>
      <div className={styles.box}>
        {state === 'completed' && id ? (
          <img className={styles.image} src={imageUrl(id)} alt={alt} />
        ) : state === 'failed' ? (
          /* **Asking again is the honest first move, so it is the only thing
             offered.** The provider answers every failure with one catch-all
             that leads with "unsafe content" and goes on to list a media-type
             mismatch and "other cases", so a transient miss accuses itself of
             moderation and sends you to edit a prompt that was never the
             problem. This says what is true -- it did not come back -- and
             gives you the press that costs 8c to find out (#699). */
          <div className={styles.failed}>
            <p className={styles.failedText}>This frame did not come back.</p>
            {/* The provider's own words, kept but not led with. They are worth
                reading -- occasionally they name a real problem -- and they
                are also the thing that makes every transient miss look like a
                moderation strike, so they sit under the plain sentence rather
                than being it. */}
            {message && (
              <div className={styles.reason}>
                <ExpandableText text={message} lines={2} copyable={false} />
              </div>
            )}
            <MiniButton
              icon={<RefreshCw className={styles.icon} />}
              spinning={retrying}
              disabled={retrying}
              onClick={onRetry}
            >
              Try again
            </MiniButton>
          </div>
        ) : waitingOn ? (
          <p className={styles.waiting}>Waiting for the opening frame.</p>
        ) : (
          <Skeleton className={styles.pending} />
        )}
      </div>
      <figcaption className={styles.caption}>{label}</figcaption>
    </figure>
  )
}
