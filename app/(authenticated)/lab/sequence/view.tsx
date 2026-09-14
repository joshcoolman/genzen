'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { ClipPicker } from '../_components/clip-picker/clip-picker'
import { LabPage } from '../_components/lab-page/lab-page'
import { ClipRow } from './_components/clip-row/clip-row'
import {
  AddGenDialog,
  EditClipDialog,
} from './_components/clip-dialog/clip-dialog'
import { SequencePlayer } from './_components/sequence-player/sequence-player'
import { useView } from './use-view'
import styles from './view.module.css'
import type { SequencePlayerHandle } from './_components/sequence-player/sequence-player'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { clipName } from '#/features/video/clip-facts'
import { Button } from '#/components'

/**
 * The player on top, the run underneath it -- the shape of an editor without
 * being one. No `instructionFile`: nothing here is sent to a model, so there is
 * no prose to go and tune. Frames is the other page like that, and the run's
 * own generation (#660) does not change it -- the prompt goes to FAL as typed,
 * with no rewrite in between.
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
      question="Watch a run of clips back to back. Does the order cut together, and does the next one follow?"
    >
      <div className={styles.stack}>
        {/* Only the clips that exist. A pending one keeps its place in the row
            and is not something the stage can play, which is why the two are
            indexed separately -- see `toPlayableIndex` in `use-view`. */}
        <SequencePlayer
          clips={view.playable}
          controls={player}
          onIndexChange={view.setPlayingIndex}
        />

        <ClipRow
          clips={view.picked}
          playingIndex={view.toRowIndex(view.playingIndex)}
          onAdd={() => view.setPickerOpen(true)}
          onAddGen={view.openAdd}
          onRemove={view.removeClip}
          onMove={view.move}
          onPlayFrom={(index) => {
            const target = view.toPlayableIndex(index)
            if (target >= 0) player.current?.playFrom(target)
          }}
          onRename={view.openEdit}
        />

        {/* **A real button, because the run now outlives the visit** (#659).
            As a quiet text link it was the undo for something that would be
            gone anyway by the next visit; it is now the only way to empty a
            run that will otherwise still be here tomorrow. It forgets the
            stored run as well -- Clear means clear. */}
        {view.picked.length > 0 && (
          <div className={styles.footer}>
            <Button variant="secondary" size="sm" onClick={view.clear}>
              <X size={14} />
              Clear the run
            </Button>
          </div>
        )}
      </div>

      {/* The pencil: a name, or another take of the same position (#657, #660).
          The run keeps playing behind it. */}
      <EditClipDialog
        open={view.editing !== null}
        onOpenChange={(open) => {
          if (!open) view.setEditing(null)
        }}
        name={view.editing ? (clipName(view.editing) ?? '') : ''}
        onRename={(name) => {
          if (view.editing) void view.renameClip(view.editing, name)
        }}
        /* An uploaded clip carries no record of how it was made, so there is
           nothing to refill a request from and the tab is not offered. */
        canRegenerate={Boolean(view.editing?.generation_metadata)}
        form={view.genForm}
        onRegenerate={view.submitGen}
      />

      {/* Add gen: the clip that comes after the run (#660). */}
      <AddGenDialog
        open={view.genOpen}
        onOpenChange={view.setGenOpen}
        form={view.genForm}
        onSubmit={view.submitGen}
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
