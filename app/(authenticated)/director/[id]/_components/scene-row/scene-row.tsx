'use client'

import { RefreshCw } from 'lucide-react'
import { frameState } from '../../board'
import styles from './scene-row.module.css'
import type { FrameState } from '../../board'
import type { FrameStatus } from '../../use-storyboard'
import type { BoardScene } from '../../../_lib/types'
import { MiniButton, Skeleton } from '#/components'
import { imageUrl } from '#/lib/image-url'

/**
 * One scene of a storyboard (#695): what it says, and the two frames it runs
 * between.
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
  onRerun,
}: {
  scene: BoardScene
  status: FrameStatus
  onRerun: (scene: BoardScene) => void
}) {
  return (
    <li className={styles.scene}>
      <div className={styles.meta}>
        <p className={styles.title}>
          <span className={styles.number}>{scene.number}</span>
          {scene.title}
        </p>
        <ol className={styles.lines}>
          {scene.lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
        <p className={styles.facts}>
          {/* What the scene's clips ran to, summed. A measurement rather than a
              recommendation, as the Script tab's is. */}
          {scene.seconds === null ? null : <span>{scene.seconds}s</span>}
          <span>
            {scene.lines.length} {scene.lines.length === 1 ? 'line' : 'lines'}
          </span>
        </p>
        {/* What was typed into the last re-run, so the row says what it was
            asked for rather than leaving a changed frame unexplained. */}
        {scene.guidance && <p className={styles.guidance}>{scene.guidance}</p>}
        <MiniButton
          icon={<RefreshCw className={styles.icon} />}
          onClick={() => onRerun(scene)}
        >
          Rerun with guidance
        </MiniButton>
      </div>

      <div className={styles.frames}>
        <Frame
          id={scene.openingId}
          state={frameState(scene.openingId, status)}
          label="Opens on"
          alt={`${scene.title}, opening frame`}
        />
        <Frame
          id={scene.closingId}
          state={frameState(scene.closingId, status)}
          label="Ends on"
          alt={`${scene.title}, closing frame`}
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
