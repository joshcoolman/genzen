'use client'

import { useEffect, useRef } from 'react'
import { SessionHeading } from '../_components/session-heading/session-heading'
import { ChatPanel } from './_components/chat-panel/chat-panel'
import { DeriveDialog } from './_components/derive-dialog/derive-dialog'
import { ReferenceTab } from './_components/reference-tab/reference-tab'
import { FilmDialog } from './_components/film-dialog/film-dialog'
import { RerunDialog } from './_components/rerun-dialog/rerun-dialog'
import { TakeDialog } from './_components/take-dialog/take-dialog'
import { StoryboardTab } from './_components/storyboard-tab/storyboard-tab'
import { ScriptTab } from './_components/script-tab/script-tab'
import { SessionTabs } from './_components/session-tabs/session-tabs'
import { ClipRow } from './_components/clip-row/clip-row'
import { CutTabs } from './_components/cut-tabs/cut-tabs'
import {
  AddGenDialog,
  EditClipDialog,
} from './_components/clip-dialog/clip-dialog'
import { ScriptDialog } from './_components/script-dialog/script-dialog'
import { SequencePlayer } from './_components/sequence-player/sequence-player'
import { dialogueOf } from './script'
import { visibleTab } from './tabs'
import { useCuts } from './use-cuts'
import { useReferences } from './use-references'
import { useStoryboard } from './use-storyboard'
import { useView } from './use-view'
import styles from './view.module.css'
import type { SequencePlayerHandle } from './_components/sequence-player/sequence-player'
import type { RefAsset } from '../_actions/references.action'
import type { RefKind, Session } from '../_lib/types'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { clipName } from '#/features/video/clip-facts'
import { ImageViewer } from '#/components'

/**
 * A session: the player on top, the run underneath it (#662).
 *
 * This is Sequence's workspace, moved out of the lab whole. What changed in the
 * move is where the run lives -- `director_sessions.cut`, against a revision,
 * rather than one `localStorage` record -- and that the page has a name at the
 * top of it. Nothing here is sent to a model: the prompt goes to FAL as typed.
 *
 * Unless the session is a chat (#670), in which case the words typed go to a
 * character and what reaches FAL is the character's answer. The chat box sits
 * under the player and the row turns read-only.
 */
export function View({
  session,
  clips,
  refs,
  frames,
}: {
  session: Session
  clips: Array<VideoRecord>
  refs: Record<RefKind, Array<RefAsset>>
  /** The storyboard's frames, by row id (#695). */
  frames: Record<string, RefAsset>
}) {
  const view = useView(session, clips)
  const cuts = useCuts(session, view.afterSaves)
  const references = useReferences(session.id, refs)
  const storyboard = useStoryboard(session.id, session.board, frames)
  /* A storyboard is planned from a script and drawn from the sheets, so all
     three have to exist before the tab is worth offering (#695). */
  const canStoryboard =
    view.chat !== null &&
    refs.characters.length > 0 &&
    refs.locations.length > 0
  /* The tab the nav is drawing, which is not always the tab that was chosen:
     Script and Storyboard can lose what they are made of while you are
     standing on one of them (#707). `visibleTab` is the single answer both
     read. */
  const tab = visibleTab(references.tab, {
    script: view.chat !== null,
    storyboard: canStoryboard,
  })
  /** Which reference tab is showing, or null for Work and Script. */
  const kind: RefKind | null =
    tab === 'characters' || tab === 'locations' ? tab : null
  /* The row drives the player and nothing drives the row, so the one call
     between them is imperative: a tile click has to reach the `<video>`
     elements, and routing it through state re-introduces the bail-out that
     makes clicking the clip already playing do nothing (see the player). */
  const player = useRef<SequencePlayerHandle>(null)

  /* An answer finished: play it from its first clip (#670). Imperative for the
     same reason a tile click is -- it has to reach the elements. */
  const { answerReady, toPlayableIndex: playableIndexOf } = view
  const playedTurn = useRef<string | null>(null)
  useEffect(() => {
    if (!answerReady || playedTurn.current === answerReady.turnId) return
    playedTurn.current = answerReady.turnId
    /* Only when the stage is idle. Questions queue, so an answer can land
       while the previous one is still being said -- and the run simply
       continues into it, because it is the next clip. Jumping would cut the
       previous answer off mid-sentence. */
    if (player.current?.isPlaying()) return
    const target = playableIndexOf(answerReady.rowIndex)
    if (target >= 0) player.current?.playFrom(target)
  }, [answerReady, playableIndexOf])

  return (
    <>
      <SessionHeading id={session.id} name={session.name}>
        {/* Only once there is something to extract from (#690) -- in any cut,
            since the sheets are the session's and an empty new cut does not
            take them away (#744). Extraction reads the open cut. */}
        {session.cuts.cuts.some((cut) => cut.clipIds.length > 0) && (
          <SessionTabs
            tab={tab}
            onChange={references.setTab}
            script={view.chat !== null}
            counts={{
              characters: refs.characters.length,
              locations: refs.locations.length,
            }}
            storyboard={canStoryboard}
          />
        )}
      </SessionHeading>

      {/* A reference tab replaces the work area's body and nothing else: the
          player, the row and the chat panel are the work tab's, and the heading
          above is the session's. Replaces rather than hides -- a hidden
          `<video>` keeps playing, and a stage you cannot see talking over the
          tab you are reading is the wrong answer. */}
      {tab === 'script' ? (
        /* The run's dialogue, read off the clips in the order they play. */
        <ScriptTab lines={dialogueOf(view.picked)} />
      ) : tab === 'storyboard' ? (
        /* The same script as frames: what each scene opens on and ends on,
           before any video exists (#695). */
        <StoryboardTab
          board={session.board}
          status={storyboard.status}
          frames={frames}
          busy={storyboard.creating}
          generating={storyboard.generating}
          retrying={storyboard.retrying}
          pronouncing={storyboard.pronouncing}
          onCreate={() => void storyboard.create()}
          onPronounce={() => void storyboard.pronounce()}
          onChooseModel={(slug) => void storyboard.chooseModel(slug)}
          onRerun={storyboard.openRerun}
          onSwap={(scene) => void storyboard.swap(scene)}
          onRetry={(scene, which) => void storyboard.retry(scene, which)}
          onFilm={storyboard.openFilm}
          onWatch={storyboard.setWatching}
          onDropTake={(scene, takeId) =>
            void storyboard.removeTake(scene, takeId)
          }
          onEditLine={(scene, spoken) =>
            void storyboard.editLine(scene, spoken)
          }
        />
      ) : kind !== null ? (
        <ReferenceTab
          kind={kind}
          assets={refs[kind]}
          busy={references.busy === kind}
          onExtract={() => void references.extract(kind)}
          onDerive={references.openDerive}
          onDelete={(asset) => void references.drop(asset)}
          onOpen={references.openViewer}
        />
      ) : (
        <>
          {/* A run's cuts (#744). A chat has one, and its turns are what order
            it, so it gets no tabs. */}
          {!view.chat && (
            <CutTabs
              cuts={cuts.cuts}
              active={cuts.active}
              busy={cuts.busy}
              onOpen={(cutId) => void cuts.open(cutId)}
              onAdd={() => void cuts.add()}
              onDelete={(cutId) => void cuts.remove(cutId)}
            />
          )}
          <div className={styles.stack}>
            {/* Only the clips that exist. A pending one keeps its place in the row
            and is not something the stage can play, which is why the two are
            indexed separately -- see `toPlayableIndex` in `use-view`. */}
            <div className={styles.player}>
              <SequencePlayer
                clips={view.playable}
                /* A chat is vertical before its first clip exists (#670), so the
               empty stage is already the shape the answer will be. */
                ratio={view.runRatio ?? (view.chat ? 9 / 16 : null)}
                /* The transcript and the question box share the sticky column
               with the stage, so a 9:16 stage at 70vh put the box off screen.
               Half the viewport leaves room for both, and the clip is still
               large enough to be a face. */
                stageMax={view.chat ? '45vh' : undefined}
                /* A conversation: an answer plays once and stops, unless Loop is
               pressed. A run always loops and gets no button. */
                loop={view.chat ? view.loop : true}
                onLoopChange={view.chat ? view.setLoop : undefined}
                controls={player}
                onIndexChange={view.setPlayingIndex}
                placeholder={
                  view.chat
                    ? 'The answer plays here.'
                    : 'Add clips below to start the run.'
                }
              />
              {view.chat && (
                <ChatPanel
                  turns={view.chat.turns}
                  inFlight={view.inFlight}
                  queued={view.queued}
                  answering={view.answering}
                  onAsk={(question, steer) => void view.ask(question, steer)}
                />
              )}
            </div>

            <div>
              <ClipRow
                clips={view.picked}
                mode={view.chat ? 'chat' : 'run'}
                playingIndex={view.toRowIndex(view.playingIndex)}
                onAddGen={view.openAdd}
                /* A chat's script is the questions and answers, not the clip
               prompts: those are anchors plus an action, assembled in code,
               and the words that matter are the ones said. */
                onScript={() =>
                  view.chat
                    ? view.setTranscriptOpen(true)
                    : view.setScriptOpen(true)
                }
                onRemove={view.removeClip}
                onRerun={
                  view.chat ? (clip) => void view.rerunClip(clip) : undefined
                }
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
        </>
      )}

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

      {/* A chat's Script: the conversation so far, opened on purpose (#670). */}
      <ScriptDialog
        open={view.transcriptOpen}
        onOpenChange={view.setTranscriptOpen}
        script={view.transcript}
      />

      {/* The lightbox, over the open tab (#690). Images' own, with Director's
          own cursor behind it -- see `use-references`. No Hide: this
          collection is pruned by deleting. */}
      {references.viewing !== null && (
        <ImageViewer
          items={references.viewerItems}
          imageUrls={references.viewerUrls}
          currentIndex={references.viewing}
          onClose={references.closeViewer}
          onNext={references.viewerNext}
          onPrev={references.viewerPrev}
          onDelete={() => void references.dropViewed()}
        />
      )}

      {/* New from this: one more asset, from a sheet and some words (#690). */}
      <DeriveDialog
        asset={references.deriving}
        words={references.words}
        onWordsChange={references.setWords}
        models={references.models}
        onToggleModel={references.toggleModel}
        busy={references.submitting}
        onSubmit={() => void references.derive()}
        onOpenChange={(open) => {
          if (!open) references.setDeriving(null)
        }}
      />

      {/* Rerun with guidance: this scene's pair, made again (#695). */}
      <RerunDialog
        scene={storyboard.rerunning}
        words={storyboard.words}
        onWordsChange={storyboard.setWords}
        model={storyboard.model}
        onModelChange={storyboard.setModel}
        busy={storyboard.submitting}
        onSubmit={() => void storyboard.rerun()}
        onOpenChange={(open) => {
          if (!open) storyboard.setRerunning(null)
        }}
      />

      {/* Generate video: the section this row was a spec for (#697). */}
      <FilmDialog
        scene={storyboard.filming}
        model={session.board.model}
        spoken={storyboard.spoken}
        onSpokenChange={storyboard.setSpoken}
        words={storyboard.words}
        onWordsChange={storyboard.setWords}
        endFrame={storyboard.endFrame}
        onEndFrameChange={storyboard.setEndFrame}
        busy={
          storyboard.filming !== null &&
          storyboard.generating.includes(storyboard.filming.id)
        }
        onSubmit={() => void storyboard.film()}
        onOpenChange={(open) => {
          if (!open) storyboard.setFilming(null)
        }}
      />

      {/* One take, played over the board. */}
      <TakeDialog
        takeId={storyboard.watching}
        label={storyboard.watchingLabel}
        onOpenChange={(open) => {
          if (!open) storyboard.setWatching(null)
        }}
      />

      {/* Add gen: the clip that comes after the run (#660). */}
      <AddGenDialog
        open={view.genOpen}
        onOpenChange={view.setGenOpen}
        form={view.genForm}
        onSubmit={view.submitGen}
      />
    </>
  )
}
