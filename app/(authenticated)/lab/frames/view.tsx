'use client'

import { Trash2 } from 'lucide-react'
import { LabPage } from '../_components/lab-page/lab-page'
import { ClipInput } from './_components/clip-input/clip-input'
import { useView } from './use-view'
import styles from './view.module.css'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { ActionButton, Button, EmptyState } from '#/components'

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
      {clips.length === 0 ? (
        <EmptyState title="No clips yet">
          Generate a clip on the Video page and it will show up here.
        </EmptyState>
      ) : (
        <>
          {/* The plus button, and the picker behind it. A scrolling row of
              every clip was the first version and it is fine at eleven and
              useless at five hundred; picking an image already works this way,
              so picking a clip should too. */}
          <ClipInput
            clips={clips}
            picked={v.picked}
            onPick={v.pickClips}
            onRemove={v.removeClip}
            disabled={v.isExtracting}
          />

          {v.clip && (
            <div className={styles.stage}>
              {/* `key` on the clip id: swapping `src` on a mounted <video>
                  keeps the old currentTime and the old decoded frame, so the
                  first extraction after a switch would come out of the
                  previous clip. */}
              <video
                key={v.clip.id}
                ref={v.videoRef}
                className={styles.player}
                src={`/img/${v.clip.id}#t=0.001`}
                controls
                preload="metadata"
                playsInline
              />
              <div className={styles.actions}>
                <ActionButton
                  onClick={() => void v.extract()}
                  loading={v.isExtracting}
                  loadingText="Extracting"
                >
                  Extract frame
                </ActionButton>
                {v.frames.length > 0 && (
                  <Button variant="ghost" onClick={() => void v.clearFrames()}>
                    Clear ({v.frames.length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* The grid grows across clips rather than resetting: comparing a
              frame from one clip against a frame from another is most of what
              there is to judge here. */}
          <div className={styles.grid}>
            {v.frames.map((f) => (
              <figure key={f.id} className={styles.frame}>
                <img
                  className={styles.image}
                  src={f.url}
                  alt={`${f.clipTitle} at ${stamp(f.timeSeconds)}`}
                  style={{ aspectRatio: `${f.width} / ${f.height}` }}
                />
                <figcaption className={styles.caption}>
                  <span className={styles.meta}>
                    {f.clipTitle} · {stamp(f.timeSeconds)}
                  </span>
                  <button
                    type="button"
                    className={styles.destructive}
                    onClick={() => void v.removeFrame(f.id)}
                    disabled={v.busyId === f.id}
                    aria-label="Trash frame"
                  >
                    <Trash2 size={12} />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </LabPage>
  )
}
