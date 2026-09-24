'use client'

import { Download } from 'lucide-react'
import { EditHeading } from '../_components/edit-heading/edit-heading'
import { CutPlayer } from './_components/cut-player/cut-player'
import { Timeline } from './_components/timeline/timeline'
import { formatClock, locate } from './cut'
import { useView } from './use-view'
import styles from './view.module.css'
import type { Edit } from '../_lib/types'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { Button, ClipPicker } from '#/components'

/**
 * An edit: the stage on top, the timeline under it (#726).
 *
 * The timeline drives the player and nothing drives the timeline: a tile
 * click, a ruler press and a scrub all reach the `<video>` elements through
 * the handle, as Director's tile click does, and the player reports its
 * position and clock back for the strip to draw.
 */
export function View({
  edit,
  clips,
}: {
  edit: Edit
  clips: Array<VideoRecord>
}) {
  const view = useView(edit, clips)
  const player = view.player
  const seek = (seconds: number) => {
    const at = locate(view.items, seconds)
    if (at) player.current?.seekTo(at.index, at.offset)
  }

  return (
    <>
      <EditHeading id={edit.id} name={edit.name} />
      <div className={styles.stack}>
        <CutPlayer
          items={view.items}
          ratio={view.runRatio}
          controls={player}
          onIndexChange={view.setPlayingIndex}
          onTimeChange={view.setTime}
          onDuration={view.learnDuration}
        >
          <span className={styles.clock}>
            {formatClock(view.time)} / {formatClock(view.total)}
          </span>
          {/* The cut as one file, on the Video wall. Sits with the clock
              because the clock is what says whether the cut is worth it. */}
          <Button
            size="sm"
            disabled={view.items.length === 0 || view.exporting}
            onClick={() => void view.exportCut()}
          >
            <Download size={14} />
            {view.exporting ? 'Exporting...' : 'Export to Video'}
          </Button>
          {view.error && (
            <p role="alert" className={styles.error}>
              {view.error}
            </p>
          )}
        </CutPlayer>
        <Timeline
          items={view.items}
          durations={view.durations}
          playingIndex={view.playingIndex}
          time={view.time}
          onAdd={() => view.setPicking(true)}
          onRemove={view.remove}
          onMove={view.move}
          onTrim={view.trim}
          onPlayFrom={(index, offset) => player.current?.seekTo(index, offset)}
          onSeek={seek}
        />
      </div>
      <ClipPicker
        open={view.picking}
        onOpenChange={view.setPicking}
        clips={clips}
        /* Nothing is greyed out: a clip already in the cut can go in again.
           The badge says where it already is. */
        pickedIds={new Set()}
        positions={view.positions}
        onConfirm={view.add}
        max={50}
        matchRatio={view.runRatio}
      />
    </>
  )
}
