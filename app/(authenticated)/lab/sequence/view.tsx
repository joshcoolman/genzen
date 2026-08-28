'use client'

import { ClipPicker } from '../_components/clip-picker/clip-picker'
import { LabPage } from '../_components/lab-page/lab-page'
import { ClipRow } from './_components/clip-row/clip-row'
import { SequencePlayer } from './_components/sequence-player/sequence-player'
import { useView } from './use-view'
import styles from './view.module.css'
import type { VideoRecord } from '../../video/_actions/generate-video.action'

/**
 * The player on top, the run underneath it -- the shape of an editor without
 * being one. No `instructionFile`: nothing here is sent to a model, so there is
 * no prose to go and tune. Frames is the other page like that.
 */
export function View({ clips }: { clips: Array<VideoRecord> }) {
  const view = useView(clips)

  return (
    <LabPage
      title="Sequence"
      question="Watch a run of clips back to back. Does the order actually cut together?"
    >
      <div className={styles.stack}>
        <SequencePlayer
          clips={view.picked}
          onIndexChange={view.setPlayingIndex}
        />

        <ClipRow
          clips={view.picked}
          playingIndex={view.playingIndex}
          onAdd={() => view.setPickerOpen(true)}
          onRemove={view.removeClip}
          onMove={view.move}
        />

        {view.picked.length > 0 && (
          <div className={styles.footer}>
            <span className={styles.count}>
              {view.picked.length} clip{view.picked.length === 1 ? '' : 's'} in
              the run
            </span>
            <button type="button" className={styles.clear} onClick={view.clear}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Every clip you have is pickable -- a run has no length of its own, so
          the only honest cap is the library. The picker was written for more
          than one from the start; this is the number it was waiting for. With
          exactly one clip it auto-confirms on the click, which is the right
          behaviour for a choice that can only go one way. */}
      <ClipPicker
        open={view.pickerOpen}
        onOpenChange={view.setPickerOpen}
        clips={view.clips}
        pickedIds={new Set(view.picked.map((c) => c.id))}
        onConfirm={view.addClips}
        max={view.clips.length || 1}
        /* The first clip picked sets the run's shape and every later one has to
           match it (#512). Read off the run rather than chosen: you pick a
           shape by picking a clip, which is one decision instead of two, and an
           empty run constrains nothing. */
        matchRatio={view.runRatio}
      />
    </LabPage>
  )
}
