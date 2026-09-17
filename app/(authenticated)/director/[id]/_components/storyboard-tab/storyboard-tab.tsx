'use client'

import { SceneRow } from '../scene-row/scene-row'
import { FRAME_MODEL_SLUG, boardVideoCostCents } from '../../board'
import styles from './storyboard-tab.module.css'
import type { FrameStatus } from '../../use-storyboard'
import type { RefAsset } from '../../../_actions/references.action'
import type { BoardScene, StoredBoard } from '../../../_lib/types'
import { Button, CostNote, EmptyState } from '#/components'
import { estimateImageCostCents } from '#/features/ai-images/models'
import { formatCost } from '#/features/video/models'

/**
 * The storyboard (#695): every line of the script as the frame it opens on and
 * the frame it ends on, before any video exists.
 *
 * **One row per numbered line**, because a line is what becomes a video section
 * of its own length. The board is the script with pictures against it, and its
 * numbers are the Script tab's numbers.
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
  frames,
  busy,
  generating,
  retrying,
  onCreate,
  onRerun,
  onRetry,
  onFilm,
  onWatch,
}: {
  board: StoredBoard
  status: FrameStatus
  frames: Record<string, RefAsset>
  busy: boolean
  /** The rows with a section in flight. */
  generating: Array<string>
  /** The rows asking for a failed frame again. */
  retrying: Array<string>
  onCreate: () => void
  onRerun: (scene: BoardScene) => void
  onRetry: (scene: BoardScene, which: 'opening' | 'closing') => void
  onFilm: (scene: BoardScene) => void
  onWatch: (takeId: string) => void
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

  /* What this board has spent on video, which is the number the per-row button
     makes easy to lose track of (#697). */
  const spent = boardVideoCostCents(scenes)
  const takes = scenes.reduce((total, s) => total + s.videoIds.length, 0)

  if (scenes.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyState title="No storyboard yet">
          Draw the first and last frame of every line in the script, from the
          character and location sheets. Two images a line, and no video.
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
          {takes > 0 && (
            <span className={styles.spent}>
              {' '}
              · {takes} {takes === 1 ? 'take' : 'takes'}, {formatCost(spent)}
            </span>
          )}
        </p>
        <CostNote cents={cents} unpriced={unpriced} />
        <Button onClick={onCreate} loading={busy}>
          Draw again
        </Button>
      </div>
      <ol className={styles.scenes}>
        {scenes.map((scene) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            status={status}
            frames={frames}
            filming={generating.includes(scene.id)}
            retrying={retrying.includes(scene.id)}
            onRerun={onRerun}
            onRetry={onRetry}
            onFilm={onFilm}
            onWatch={onWatch}
          />
        ))}
      </ol>
    </div>
  )
}
