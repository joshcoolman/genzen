'use client'

import { Trash2 } from 'lucide-react'
import { LabPage } from '../_components/lab-page/lab-page'
import { SourceInput } from './_components/source-input/source-input'
import { YouTubeStage } from './_components/youtube-stage/youtube-stage'
import { useView } from './use-view'
import styles from './view.module.css'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { Button, EmptyState } from '#/components'

function stamp(seconds: number): string {
  return `${seconds.toFixed(2)}s`
}

export function View({ clips }: { clips: Array<VideoRecord> }) {
  const v = useView(clips)

  return (
    <LabPage
      title="Frames"
      question="Does scrubbing land on the frame you actually stopped on, and is the frame worth keeping?"
      error={v.error}
    >
      {/* The strip is always here, never behind an empty state. A YouTube video
          needs no clips of your own, so gating the page on owning one would
          hide the only source that does not require one -- from exactly the
          account most likely to want it. */}
      <SourceInput
        clips={clips}
        picked={v.picked}
        youtube={v.youtube}
        onPick={v.pickClips}
        onPickYoutube={v.pickYoutube}
        onRemove={v.removeClip}
      />

      {!v.source && (
        <EmptyState title="Nothing to pull frames from">
          Pick a clip, or paste a YouTube link, and it will play here.
        </EmptyState>
      )}

      {v.source && (
        <div className={styles.stage}>
          {v.source.kind === 'clip' ? (
            /* `key` on the clip id: swapping `src` on a mounted <video> keeps
               the old currentTime and the old decoded frame, so the first
               extraction after a switch would come out of the previous clip. */
            <video
              key={v.source.clip.id}
              ref={v.videoRef}
              className={styles.player}
              src={`/img/${v.source.clip.id}#t=0.001`}
              controls
              preload="metadata"
              playsInline
            />
          ) : (
            <YouTubeStage
              key={v.source.videoId}
              videoId={v.source.videoId}
              playerRef={v.playerRef}
              onTitle={v.nameYoutube}
              onError={v.setError}
            />
          )}
          <div className={styles.actions}>
            {/* Never disabled, never a spinner. The button is meant to be hit
                repeatedly while the video runs, so it has to stay hittable --
                what is outstanding is said beside it instead. */}
            <Button variant="primary" onClick={v.extract}>
              Extract frame
            </Button>
            {v.frames.length > 0 && (
              <Button variant="ghost" onClick={() => void v.clearFrames()}>
                Clear ({v.frames.length})
              </Button>
            )}
            {v.queued > 0 && (
              <span className={styles.note}>{v.queued} cutting</span>
            )}
            {/* Where the pixels come from is worth saying once: a clip's frame
                is already decoded on screen, a YouTube frame is cut on the
                server, and the second takes a few seconds for a reason. */}
            {v.queued === 0 && v.source.kind === 'youtube' && (
              <span className={styles.note}>
                Cut on the server at the player&rsquo;s position
              </span>
            )}
          </div>
        </div>
      )}

      {/* The grid grows across sources rather than resetting: comparing a frame
          from one clip against a frame from another -- or against a still off a
          reference video -- is most of what there is to judge here. */}
      <div className={styles.grid}>
        {v.frames.map((f) => (
          <figure key={f.key} className={styles.frame}>
            {f.url ? (
              <img
                className={styles.image}
                src={f.url}
                alt={`${f.clipTitle} at ${stamp(f.timeSeconds)}`}
                style={{ aspectRatio: `${f.width} / ${f.height}` }}
              />
            ) : (
              /* The tile is here from the moment of the click, so a run of
                 quick clicks reads back as a run of frames in the order they
                 were asked for -- rather than the grid staying empty and then
                 filling in all at once. */
              <div
                className={f.error ? styles.failed : styles.waiting}
                role="status"
              >
                {f.error ? 'Failed' : null}
              </div>
            )}
            <figcaption className={styles.caption}>
              <span className={styles.meta}>
                {f.clipTitle} · {stamp(f.timeSeconds)}
              </span>
              <button
                type="button"
                className={styles.destructive}
                onClick={() => void v.removeFrame(f)}
                disabled={!!f.id && v.busyId === f.id}
                aria-label="Trash frame"
              >
                <Trash2 size={12} />
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </LabPage>
  )
}
