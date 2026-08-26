'use client'

import { VideoThumb } from '../video-thumb/video-thumb'
import styles from './video-list.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { EmptyState } from '#/components'

/**
 * Every clip, newest first.
 *
 * The grid and nothing else: a card is `VideoThumb`, which owns the player, the
 * badge and the caption. They were one file until the caption's type had
 * drifted a full step off the image card's -- a list is a layout, a card is a
 * record, and only the second of those has a scale to keep.
 */
export function VideoList({
  videos,
  onDelete,
  onContinue,
  continuingId,
}: {
  videos: Array<VideoRecord>
  onDelete: (id: string) => void
  onContinue: (video: VideoRecord) => void
  /** The clip whose last frame is being read, if any -- one at a time. */
  continuingId: string | null
}) {
  if (videos.length === 0) {
    return (
      <EmptyState title="No clips yet">
        Say what should happen, and generate. A first frame is optional.
      </EmptyState>
    )
  }

  return (
    <div className={styles.list}>
      {videos.map((video) => (
        <VideoThumb
          key={video.id}
          video={video}
          onDelete={onDelete}
          onContinue={onContinue}
          isContinuing={continuingId === video.id}
        />
      ))}
    </div>
  )
}
