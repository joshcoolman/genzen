import { useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { download } from '../../recording'
import { DURATIONS, ENDPOINTS, PROMPT_LIMIT } from '../../clips'
import { CutPlayer } from '../cut-player/cut-player'
import { ExportPreview } from '../export-preview/export-preview'
import styles from './workspace.module.css'
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
  const locked = !state.ready || state.busy || !!cut.pending
  const canSend = !locked && !!state.prompt.trim()
  const latest = cut.clips.at(-1)
  return (
    <div className={styles.workspace} data-opening={opening || undefined}>
      {!opening && (
        <div className={styles.stage}>
          <CutPlayer clips={cut.clips} />
          <p role="status" className={styles.hint}>
            {state.status}
          </p>
          <p className={styles.hint}>
            New sections append without restarting playback. The
            ending-to-opening loop may have a visible cut.
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
      {(!opening || cut.pending) && (
        <aside className={styles.history}>
          {!opening && <h2>Sections · {cut.clips.length}</h2>}
          <ol>
            {cut.clips.map((clip, index) => (
              <li key={clip.id}>
                <p>{clip.prompt}</p>
                <span>
                  {clip.duration.toFixed(1)}s · {clip.model}
                  {clip.elapsedMs !== undefined
                    ? ` · ${(clip.elapsedMs / 1000).toFixed(1)}s request-to-ready`
                    : ''}
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    download(
                      clip.blob,
                      `section-${index + 1}.${clip.blob.type.includes('webm') ? 'webm' : 'mp4'}`,
                    )
                  }
                >
                  Download
                </Button>
              </li>
            ))}
          </ol>
          {cut.pending && (
            <div>
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
        </aside>
      )}
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault()
          if (canSend) void state.submit(false)
        }}
      >
        <label htmlFor="director-prompt">
          {opening ? 'Set the scene' : 'Next direction'}
        </label>
        <Textarea
          id="director-prompt"
          value={state.prompt}
          rows={opening ? 5 : 3}
          maxLength={PROMPT_LIMIT}
          disabled={!state.ready}
          placeholder={
            opening ? 'Describe the opening scene...' : 'What happens next?'
          }
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
              if (canSend) void state.submit(false)
            }
          }}
        />
        <div className={styles.actions}>
          {opening && <span>One paid {cut.settings.duration}-second clip</span>}
          {!!latest && (
            <Button
              disabled={!canSend || !!latest.imported}
              onClick={() => {
                void state.submit(true)
              }}
              title={
                latest.imported
                  ? 'A saved live recording can be continued, but not regenerated as a single clip.'
                  : 'Replace the latest section using its original starting frame'
              }
            >
              Redo latest
            </Button>
          )}
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
        {opening ? (
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
        ) : (
          <p className={styles.hint}>
            Each Send or Redo generates one paid {cut.settings.duration}-second
            clip. Playback and waiting do not generate anything.
          </p>
        )}
      </form>
      <details className={styles.settings}>
        <summary>Generation settings</summary>
        <fieldset disabled={locked}>
          <label>
            Duration
            <select
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
                  {duration} seconds
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <select
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
          </label>
          <label>
            Resolution
            <select
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
          </label>
          {!cut.clips.length && (
            <label>
              Optional opening image
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  void state.changeImage(event.target.files?.[0] ?? null)
                }}
              />
            </label>
          )}
        </fieldset>
        {!cut.clips.length && cut.initialImage && (
          <p>
            Opening image saved.{' '}
            <Button
              disabled={locked}
              onClick={() => {
                void state.changeImage(null)
              }}
            >
              Remove image
            </Button>
          </p>
        )}
        <p className={styles.hint}>
          Balanced prompt expansion · {cut.settings.duration} seconds · silent
          playback. These endpoints expose no audio-off switch; generated files
          may contain audio. Continuations inherit the previous ending frame’s
          shape. Text-only openings default to 16:9.
        </p>
        <p className={styles.hint}>
          <a
            href={`https://fal.ai/models/${ENDPOINTS[cut.settings.model]}`}
            target="_blank"
            rel="noreferrer"
          >
            Provider pricing and model details
          </a>
        </p>
      </details>
      {!!state.archives.length && (
        <details className={styles.recordings}>
          <summary>Saved Director recordings ({state.archives.length})</summary>
          <p className={styles.hint}>
            Original recordings from the live-stream experiment are preserved
            unchanged.
          </p>
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
