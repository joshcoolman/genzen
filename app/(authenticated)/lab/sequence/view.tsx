'use client'

import { useRef } from 'react'
import { ClipPicker } from '../_components/clip-picker/clip-picker'
import { LabPage } from '../_components/lab-page/lab-page'
import { ClipRow } from './_components/clip-row/clip-row'
import { SequencePlayer } from './_components/sequence-player/sequence-player'
import { useView } from './use-view'
import styles from './view.module.css'
import type { SequencePlayerHandle } from './_components/sequence-player/sequence-player'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { clipName } from '#/features/video/clip-facts'
import { NameDialog } from '#/components'

/**
 * The player on top, the run underneath it -- the shape of an editor without
 * being one. No `instructionFile`: nothing here is sent to a model, so there is
 * no prose to go and tune. Frames is the other page like that.
 */
export function View({ clips }: { clips: Array<VideoRecord> }) {
  const view = useView(clips)
  /* The row drives the player and nothing drives the row, so the one call
     between them is imperative: a tile click has to reach the `<video>`
     elements, and routing it through state re-introduces the bail-out that
     makes clicking the clip already playing do nothing (see the player). */
  const player = useRef<SequencePlayerHandle>(null)

  return (
    <LabPage
      title="Sequence"
      question="Watch a run of clips back to back. Does the order actually cut together?"
    >
      <div className={styles.stack}>
        <SequencePlayer
          clips={view.picked}
          controls={player}
          onIndexChange={view.setPlayingIndex}
        />

        <ClipRow
          clips={view.picked}
          playingIndex={view.playingIndex}
          onAdd={() => view.setPickerOpen(true)}
          onRemove={view.removeClip}
          onMove={view.move}
          onPlayFrom={(index) => player.current?.playFrom(index)}
          onRename={view.setRenaming}
        />

        {view.picked.length > 0 && (
          <div className={styles.footer}>
            <button type="button" className={styles.clear} onClick={view.clear}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* A name, and nothing else -- the run keeps playing behind it (#657).
          The clip is born called after the model that made it, so the field
          opens empty rather than seeded with a label nobody typed. */}
      <NameDialog
        open={view.renaming !== null}
        title="Name this clip"
        initialName={view.renaming ? (clipName(view.renaming) ?? '') : ''}
        confirmLabel="Save"
        onSubmit={(name) => {
          if (view.renaming) void view.renameClip(view.renaming, name)
        }}
        onCancel={() => view.setRenaming(null)}
      />

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
