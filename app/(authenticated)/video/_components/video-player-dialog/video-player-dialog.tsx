'use client'

import { useState } from 'react'
import styles from './video-player-dialog.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { Dialog, DialogContent, DialogTitle } from '#/components'
import { imageUrl } from '#/lib/image-url'

export function VideoPlayerDialog({
  video,
  onClose,
}: {
  video: VideoRecord | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!video}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={styles.dialog}>
        <DialogTitle>Video playback</DialogTitle>
        {video && <Player key={video.id} video={video} />}
      </DialogContent>
    </Dialog>
  )
}

function Player({ video }: { video: VideoRecord }) {
  const [failed, setFailed] = useState(false)
  return (
    <>
      <video
        className={styles.player}
        src={imageUrl(video.id)}
        poster={imageUrl(video.id, 'thumb')}
        controls
        autoPlay
        playsInline
        onError={() => setFailed(true)}
        aria-label={video.description || 'Generated video'}
      />
      {failed && (
        <p role="alert">
          This video could not be loaded. Close and reopen it to try again.
        </p>
      )}
    </>
  )
}
