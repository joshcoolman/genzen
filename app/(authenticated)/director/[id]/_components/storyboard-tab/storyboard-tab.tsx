'use client'

import { SceneRow } from '../scene-row/scene-row'
import { FRAME_MODEL_SLUG } from '../../board'
import styles from './storyboard-tab.module.css'
import type { FrameStatus } from '../../use-storyboard'
import type { BoardScene, StoredBoard } from '../../../_lib/types'
import { Button, CostNote, EmptyState } from '#/components'
import { estimateImageCostCents } from '#/features/ai-images/models'

/**
 * The storyboard (#695): every scene as the frame it opens on and the frame it
 * ends on, before any video exists.
 *
 * **Success here is a judgement, not a check.** If the rows read top to bottom
 * as a story that is visually interesting and coherent, it worked -- that is
 * the whole criterion, and it is deliberately not "the frames match the script"
 * or "continuity is preserved". Those are things you would measure; this is a
 * question you answer by looking, which is why the rows are large and stacked
 * rather than gridded.
 *
 * **Create storyboard replaces the board it draws.** The reference tabs are
 * collections pruned by deleting; a storyboard is an ordered thing, and two
 * plans of the same script side by side is not a storyboard. So the button
 * says so, and the frames the old board made go to Trash.
 */
export function StoryboardTab({
  board,
  status,
  busy,
  onCreate,
  onRerun,
}: {
  board: StoredBoard
  status: FrameStatus
  busy: boolean
  onCreate: () => void
  onRerun: (scene: BoardScene) => void
}) {
  const scenes = board.scenes
  /* Two frames a scene, and what a six-scene board costs is the argument for
     the tab existing: about a dollar against $38 for one video pass over the
     same script. Printed before the press, as everywhere else that spends --
     though before a plan exists there is nothing to count, so the empty state
     says what one image costs and the bar says what a re-draw costs. */
  const { cents, unpriced } = estimateImageCostCents(
    [FRAME_MODEL_SLUG],
    Math.max(scenes.length, 1) * 2,
    true,
  )

  if (scenes.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyState title="No storyboard yet">
          Break the script into scenes and draw the first and last frame of
          each, from the character and location sheets. Two images a scene, and
          no video.
        </EmptyState>
        <Button variant="primary" onClick={onCreate} loading={busy}>
          Create storyboard
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.tab}>
      <div className={styles.bar}>
        <p className={styles.count}>
          {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
        </p>
        <CostNote cents={cents} unpriced={unpriced} />
        <Button onClick={onCreate} loading={busy}>
          Plan again
        </Button>
      </div>
      <ol className={styles.scenes}>
        {scenes.map((scene) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            status={status}
            onRerun={onRerun}
          />
        ))}
      </ol>
    </div>
  )
}
