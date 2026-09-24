'use client'

import { Camera, Download, Scissors, StepForward } from 'lucide-react'
import { EditHeading } from '../_components/edit-heading/edit-heading'
import { ContinueDialog } from './_components/continue-dialog/continue-dialog'
import { CutPlayer } from './_components/cut-player/cut-player'
import { FrameStrip } from './_components/frame-strip/frame-strip'
import { Timeline } from './_components/timeline/timeline'
import { formatClock } from './cut'
import { useView } from './use-view'
import styles from './view.module.css'
import type { Edit, EditFrame } from '../_lib/types'
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
  frames,
}: {
  edit: Edit
  clips: Array<VideoRecord>
  /** The frames already saved out of it (#729). */
  frames: Array<EditFrame>
}) {
  const view = useView(edit, clips, frames)

  return (
    <>
      <EditHeading id={edit.id} name={edit.name} />
      <div className={styles.stack}>
        <CutPlayer
          /* The ready rows only (#731): a clip being made holds its place on
             the strip and is not something the stage can play. */
          items={view.playable}
          ratio={view.runRatio}
          controls={view.player}
          onIndexChange={view.setPlayableIndex}
          onPlayingChange={view.setPlaying}
          onPositionChange={view.setPositionFrom}
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
          {/* The frame on the stage, to the library (#729). F does the same. */}
          <Button
            size="sm"
            disabled={view.items.length === 0 || view.capturing}
            onClick={() => void view.capture()}
            title="Save this frame (F)"
          >
            <Camera size={14} />
            {view.capturing ? 'Saving...' : 'Save frame'}
          </Button>
          {/* Cut the clip under the playhead in two, there. Only while paused:
              that is the one state in which the playhead is a frame. */}
          {!view.playing && (
            <Button
              size="sm"
              disabled={!view.canSplit}
              onClick={view.split}
              title="Split at the playhead (S)"
            >
              <Scissors size={14} />
              Split
            </Button>
          )}
          {/* The clip between the highlighted clip and the next (#731).
              Paused only, like Split: it acts on the lit tile. */}
          {!view.playing && (
            <Button
              size="sm"
              disabled={view.playingIndex === null}
              onClick={view.openContinue}
              title="Make the clip that follows the highlighted one"
            >
              <StepForward size={14} />
              Continue
            </Button>
          )}
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
          time={view.stripSeconds}
          onAdd={() => view.setPicking(true)}
          onRemove={view.remove}
          onMove={view.move}
          onTrim={view.trim}
          onPlayFrom={view.playFromRow}
          onSeek={view.seekStrip}
        />
        {/* Under the strip: the timeline is the work and the frames are what
            came out of it. */}
        <FrameStrip
          frames={view.frames}
          groupId={view.framesGroupId}
          onTrash={view.trashFrame}
        />
      </div>
      <ContinueDialog
        draft={view.draft}
        onChange={view.setDraft}
        onClose={() => view.setDraft(null)}
        onSubmit={() => void view.submitContinue()}
      />
      <ClipPicker
        open={view.picking}
        onOpenChange={view.setPicking}
        /* Finished clips only: a pending one has nothing to trim. */
        clips={clips.filter((c) => c.status === 'completed')}
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
