import { useEffect, useRef, useState } from 'react'
import { Clapperboard, Pencil } from 'lucide-react'
import { download } from '../../recording'
import { DURATIONS, PROMPT_LIMIT } from '../../clips'
import { CutPlayer } from '../cut-player/cut-player'
import { SectionEditor } from '../section-editor/section-editor'
import { ExportPreview } from '../export-preview/export-preview'
import { mediaUrl } from '../../_lib/types'
import styles from './workspace.module.css'
import type { CutPlayerHandle } from '../cut-player/cut-player'
import type { useView } from '../../[id]/use-view'
import type { Clip, Settings } from '../../clips'
import type { StoredClip } from '../../_lib/types'
import {
  Button,
  ConfirmDialog,
  Input,
  Textarea,
  useConfirm,
} from '#/components'

export function Workspace({
  state,
  onExportSaved,
}: {
  state: ReturnType<typeof useView>
  onExportSaved: () => void
}) {
  const { confirm, dialogProps } = useConfirm()
  const { cut } = state
  const opening = state.session.cut.clips.length === 0
  const [exportClips, setExportClips] = useState<Array<Clip> | null>(null)
  const [exportSource, setExportSource] = useState<Array<StoredClip>>([])
  const player = useRef<CutPlayerHandle>(null)
  const [position, setPosition] = useState({ index: -1, paused: false })
  const [editing, setEditing] = useState<number | null>(null)
  const { review } = state
  // The replacement under review loops on its own until it is approved.
  useEffect(() => {
    if (review === null) player.current?.release()
    else player.current?.hold(review)
  }, [review])
  const stored = state.session.cut.clips
  const frames = (index: number) => ({
    start:
      index > 0
        ? (stored[index - 1] && mediaUrl(stored[index - 1].endFrameId)) || null
        : state.session.cut.initialImage
          ? mediaUrl(state.session.cut.initialImage)
          : null,
    // The next section opened on this clip's ending frame, so that is the
    // frame a replacement has to arrive at. A final section has no such seam.
    end:
      index < stored.length - 1 && stored[index]
        ? mediaUrl(stored[index].endFrameId)
        : null,
  })
  const locked = !state.ready || state.busy || !!cut.pending
  const canSend = !locked && !!state.prompt.trim()
  // Submitting, then polling: `pending` spans the wait, `busy` covers the
  // moment before the request has been accepted.
  const working = state.busy || !!cut.pending
  return (
    <div className={styles.workspace} data-opening={opening || undefined}>
      {!opening && (
        <div className={styles.stage}>
          <CutPlayer
            clips={cut.clips}
            controls={player}
            onPosition={(index, paused) => setPosition({ index, paused })}
            overlay={
              review !== null ? (
                <>
                  {working && (
                    <span role="status" className={styles.working}>
                      Generating edit…
                    </span>
                  )}
                  <Button disabled={working} onClick={() => setEditing(review)}>
                    Edit
                  </Button>
                  <Button
                    variant="primary"
                    disabled={working}
                    onClick={state.approve}
                  >
                    Approve
                  </Button>
                </>
              ) : position.paused && position.index >= 0 && !cut.pending ? (
                <Button onClick={() => setEditing(position.index)}>
                  <Pencil size={16} />
                  Edit
                </Button>
              ) : undefined
            }
          />
          <p role="status" className={styles.hint}>
            {state.status}
          </p>
          {cut.clips.some((clip) => clip.imported) && (
            <p className={styles.notice}>
              Your saved Director recording is section 1. Send continues from
              its ending frame; the original remains in Saved recordings below.
            </p>
          )}
          {state.error && (
            <p role="alert" className={styles.failure}>
              {state.error}
            </p>
          )}
          <div className={styles.actions}>
            <Button
              disabled={!state.ready || !cut.clips.length}
              onClick={() => {
                setExportSource([...state.session.cut.clips])
                setExportClips([...cut.clips])
              }}
            >
              Export Final Video
            </Button>
          </div>
        </div>
      )}
      <aside className={styles.side}>
        {(!opening || cut.pending) && (
          <div className={styles.history}>
            {!opening && <h2>Sections · {cut.clips.length}</h2>}
            <ol>
              {cut.clips.map((clip, index) => (
                <li key={clip.id}>
                  <button
                    type="button"
                    className={styles.section}
                    data-current={index === position.index || undefined}
                    aria-current={index === position.index ? 'true' : undefined}
                    onClick={() => {
                      if (index === position.index) player.current?.toggle()
                      else player.current?.jump(index)
                    }}
                  >
                    <p>{clip.prompt}</p>
                    <span>{clip.duration.toFixed(1)}s</span>
                  </button>
                </li>
              ))}
            </ol>
            {cut.pending && (
              <div className={styles.pending}>
                <p>
                  {cut.pending.redo
                    ? 'Replacing latest section'
                    : opening
                      ? 'Opening scene'
                      : 'Next section'}
                  : {cut.pending.prompt}
                </p>
                <p className={styles.hint}>
                  {state.busy ? 'Working…' : 'Request needs attention'}
                </p>
                {!!cut.pending.token && (
                  <Button disabled={state.busy} onClick={state.checkRequest}>
                    Check request
                  </Button>
                )}
                <Button
                  disabled={state.busy}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: 'Dismiss this request?',
                        message:
                          'A submitted job may still finish and be billed. Check FAL first if its submission was interrupted. Your existing sections will stay unchanged.',
                        confirmLabel: 'Dismiss request',
                      })
                    )
                      await state.forgetPending()
                  }}
                >
                  Dismiss request
                </Button>
              </div>
            )}
          </div>
        )}
        <div className={styles.panel}>
          <fieldset className={styles.settings} disabled={locked}>
            <select
              aria-label="Clip duration"
              value={cut.settings.duration}
              onChange={(event) => {
                void state.changeSettings({
                  ...cut.settings,
                  duration: Number(event.target.value) as Settings['duration'],
                })
              }}
            >
              {DURATIONS.map((duration) => (
                <option key={duration} value={duration}>
                  {duration}s
                </option>
              ))}
            </select>
            <select
              aria-label="Model"
              value={cut.settings.model}
              onChange={(event) => {
                void state.changeSettings({
                  ...cut.settings,
                  model: event.target.value as Settings['model'],
                })
              }}
            >
              <option value="turbo">MiniMax H3 Max Turbo</option>
              <option value="max">MiniMax H3 Max</option>
            </select>
            <select
              aria-label="Resolution"
              value={cut.settings.resolution}
              onChange={(event) => {
                void state.changeSettings({
                  ...cut.settings,
                  resolution: event.target.value as Settings['resolution'],
                })
              }}
            >
              <option value="480P">480p</option>
              <option value="768P">768p</option>
            </select>
          </fieldset>
          {!cut.clips.length && (
            <div className={styles.opener}>
              <label htmlFor="director-opening-image">
                Optional opening image
              </label>
              <Input
                id="director-opening-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={locked}
                onChange={(event) => {
                  void state.changeImage(event.target.files?.[0] ?? null)
                }}
              />
              {cut.initialImage && (
                <Button
                  disabled={locked}
                  onClick={() => {
                    void state.changeImage(null)
                  }}
                >
                  Remove image
                </Button>
              )}
            </div>
          )}
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault()
              if (canSend) void state.submit()
            }}
          >
            {opening && <label htmlFor="director-prompt">Set the scene</label>}
            <Textarea
              id="director-prompt"
              value={state.prompt}
              rows={opening ? 5 : 3}
              maxLength={PROMPT_LIMIT}
              disabled={!state.ready}
              placeholder={
                opening ? 'Describe the opening scene...' : 'What happens next?'
              }
              aria-label={opening ? undefined : 'Next direction'}
              aria-keyshortcuts="Shift+Enter"
              onChange={(event) => state.setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  event.shiftKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.altKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  if (canSend) void state.submit()
                }
              }}
            />
            <div className={styles.actions}>
              <Button
                type="submit"
                variant="primary"
                disabled={!canSend}
                loading={opening && state.busy}
              >
                {opening && <Clapperboard size={16} />}
                {opening ? 'Start story' : 'Send'}
              </Button>
            </div>
            {opening && (
              <>
                {state.status !== 'Saved' && (
                  <p role="status" className={styles.hint}>
                    {state.status}
                  </p>
                )}
                {state.error && (
                  <p role="alert" className={styles.failure}>
                    {state.error}
                  </p>
                )}
              </>
            )}
          </form>
        </div>
      </aside>
      {!!state.archives.length && (
        <details className={styles.recordings}>
          <summary>Saved Director recordings ({state.archives.length})</summary>
          <ul>
            {state.archives.map((take) => (
              <li key={take.id}>
                <span>
                  {new Date(take.startedAt).toLocaleString()}
                  {take.complete ? '' : ' · partial recording'}
                </span>
                <Button
                  onClick={() =>
                    download(
                      take.blob,
                      `director-${take.id}.${take.mimeType.includes('webm') ? 'webm' : 'mp4'}`,
                    )
                  }
                >
                  Download original
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {editing !== null && (
        <SectionEditor
          open
          number={editing + 1}
          prompt={cut.clips[editing]?.prompt ?? ''}
          duration={cut.settings.duration}
          startFrame={frames(editing).start}
          endFrame={frames(editing).end}
          busy={state.busy}
          onCancel={() => setEditing(null)}
          onGenerate={(text, duration) => {
            const index = editing
            setEditing(null)
            void state.regenerate(index, text, duration)
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
      {exportClips && (
        <ExportPreview
          clips={exportClips}
          source={exportSource}
          sessionId={state.session.id}
          onSaved={onExportSaved}
          onClose={() => setExportClips(null)}
        />
      )}
    </div>
  )
}
