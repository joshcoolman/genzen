'use client'

import { useRef } from 'react'
import { SessionHeading } from '../_components/session-heading/session-heading'
import { ClipRow } from './_components/clip-row/clip-row'
import {
  AddGenDialog,
  EditClipDialog,
} from './_components/clip-dialog/clip-dialog'
import { ScriptDialog } from './_components/script-dialog/script-dialog'
import { SequencePlayer } from './_components/sequence-player/sequence-player'
import { useView } from './use-view'
import styles from './view.module.css'
import type { SequencePlayerHandle } from './_components/sequence-player/sequence-player'
import type { Session } from '../_lib/types'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { clipName } from '#/features/video/clip-facts'
import { ClipPicker } from '#/components'

/**
 * A session: the player on top, the run underneath it (#662).
 *
 * This is Sequence's workspace, moved out of the lab whole. What changed in the
 * move is where the run lives -- `director_sessions.cut`, against a revision,
 * rather than one `localStorage` record -- and that the page has a name at the
 * top of it. Nothing here is sent to a model: the prompt goes to FAL as typed.
 */
export function View({
  session,
  clips,
}: {
  session: Session
  clips: Array<VideoRecord>
}) {
  const view = useView(session, clips)
  /* The row drives the player and nothing drives the row, so the one call
     between them is imperative: a tile click has to reach the `<video>`
     elements, and routing it through state re-introduces the bail-out that
     makes clicking the clip already playing do nothing (see the player). */
  const player = useRef<SequencePlayerHandle>(null)

  return (
    <>
      <SessionHeading id={session.id} name={session.name} />
      <div className={styles.stack}>
        {/* Only the clips that exist. A pending one keeps its place in the row
            and is not something the stage can play, which is why the two are
            indexed separately -- see `toPlayableIndex` in `use-view`. */}
        <div className={styles.player}>
          <SequencePlayer
            clips={view.playable}
            ratio={view.runRatio}
            controls={player}
            onIndexChange={view.setPlayingIndex}
          />
        </div>

        <div>
          <ClipRow
            clips={view.picked}
            playingIndex={view.toRowIndex(view.playingIndex)}
            onAdd={() => view.setPickerOpen(true)}
            onAddGen={view.openAdd}
            onScript={() => view.setScriptOpen(true)}
            onRemove={view.removeClip}
            onMove={view.move}
            onPlayFrom={(index) => {
              const target = view.toPlayableIndex(index)
              if (target >= 0) player.current?.playFrom(target)
            }}
            onRename={view.openEdit}
          />
          {view.error && <p role="alert">{view.error}</p>}
        </div>
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

      {/* Script: the run's prompts, verbatim, in one box to copy. */}
      <ScriptDialog
        open={view.scriptOpen}
        onOpenChange={view.setScriptOpen}
        script={view.script}
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
    </>
  )
}
