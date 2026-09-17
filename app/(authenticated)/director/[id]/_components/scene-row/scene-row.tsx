'use client'

import { Film, Play, RefreshCw } from 'lucide-react'
import { frameState, sectionCostCents } from '../../board'
import styles from './scene-row.module.css'
import type { FrameState } from '../../board'
import type { FrameStatus } from '../../use-storyboard'
import type { BoardScene } from '../../../_lib/types'
import { MiniButton, Skeleton } from '#/components'
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
export function SceneRow({
  scene,
  status,
  filming,
  onRerun,
  onFilm,
  onWatch,
}: {
  scene: BoardScene
  status: FrameStatus
  /** A section is in flight for this row, so a second press is refused rather
   *  than quietly bought. */
  filming: boolean
  onRerun: (scene: BoardScene) => void
  onFilm: (scene: BoardScene) => void
  onWatch: (takeId: string) => void
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
        <p className={styles.line}>{scene.line}</p>
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

        {/* Takes add rather than replace, so this is a list and nothing in it
            is canonical -- choosing one per row is what turns the board into a
            cut, and that is its own decision. */}
        {scene.videoIds.length > 0 && (
          <ul className={styles.takes}>
            {scene.videoIds.map((takeId, index) => {
              const state = frameState(takeId, status)
              return (
                <li key={takeId}>
                  <MiniButton
                    icon={<Play className={styles.icon} />}
                    disabled={state !== 'completed'}
                    onClick={() => onWatch(takeId)}
                  >
                    Take {index + 1}
                    {state === 'pending'
                      ? ' · working'
                      : state === 'failed'
                        ? ' · failed'
                        : ''}
                  </MiniButton>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className={styles.frames}>
        <Frame
          id={scene.openingId}
          state={frameState(scene.openingId, status)}
          label="Opens on"
          alt={`Scene ${scene.number}, opening frame`}
        />
        <Frame
          id={scene.closingId}
          state={frameState(scene.closingId, status)}
          label="Ends on"
          alt={`Scene ${scene.number}, closing frame`}
          /* The closing frame is generated from the opening one, so before that
             lands there is nothing to derive from and nothing has been asked
             for. Saying so is the difference between a queue and a hole. */
          waitingOn={
            scene.closingId === null &&
            frameState(scene.openingId, status) !== 'completed'
          }
        />
      </div>
    </li>
  )
}

function Frame({
  id,
  state,
  label,
  alt,
  waitingOn = false,
}: {
  id: string | null
  state: FrameState
  label: string
  alt: string
  waitingOn?: boolean
}) {
  return (
    <figure className={styles.frame}>
      <div className={styles.box}>
        {state === 'completed' && id ? (
          <img className={styles.image} src={imageUrl(id)} alt={alt} />
        ) : state === 'failed' ? (
          <p className={styles.failed}>This frame could not be generated.</p>
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
