'use client'

import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import { formatCost } from '../../models'
import styles from './video-list.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { EmptyState } from '#/components'

function costOf(video: VideoRecord): string | null {
  const meta = video.generation_metadata ?? {}
  const cents = meta.provider_cost_cents
  return typeof cents === 'number' ? formatCost(cents) : null
}

function durationOf(video: VideoRecord): string | null {
  const seconds = (video.generation_metadata ?? {}).duration_seconds
  return typeof seconds === 'number' ? `${seconds}s` : null
}

/**
 * Every clip, newest first.
 *
 * `preload="metadata"` is doing real work: there is no ffmpeg on the server, so
 * no poster frame was ever extracted (#305). This is what makes the browser
 * paint frame one instead of a black rectangle. Seeking works because
 * `/img/[id]` answers range requests.
 */
export function VideoList({ videos }: { videos: Array<VideoRecord> }) {
  if (videos.length === 0) {
    return (
      <EmptyState title="No clips yet">
        Pick an image, say what should happen, and generate.
      </EmptyState>
    )
  }

  return (
    <div className={styles.list}>
      {videos.map((video) => {
        const cost = costOf(video)
        const duration = durationOf(video)

        return (
          <article key={video.id} className={styles.item}>
            {video.status === 'completed' ? (
              <video
                className={styles.player}
                src={`/img/${video.id}`}
                controls
                preload="metadata"
                playsInline
              />
            ) : video.status === 'failed' ? (
              <div className={styles.state}>
                <AlertTriangle size={18} />
                <span>{video.generation_error ?? 'Generation failed'}</span>
              </div>
            ) : (
              <div className={styles.state}>
                <Loader2 className={styles.spinner} size={18} />
                <span>Generating…</span>
              </div>
            )}

            <div className={styles.meta}>
              <p className={styles.prompt}>{video.description}</p>
              <div className={styles.facts}>
                <span>{video.title}</span>
                {duration ? <span>{duration}</span> : null}
                {cost ? <span>{cost}</span> : null}
                {video.status === 'completed' ? (
                  <a
                    className={styles.download}
                    href={`/img/${video.id}`}
                    download={`${video.id}.mp4`}
                  >
                    <Download size={14} />
                    Download
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
