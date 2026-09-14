'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import styles from './video-player-dialog.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { Button, Dialog, DialogContent, DialogTitle } from '#/components'
import { clipName } from '#/features/video/clip-facts'
import { imageUrl } from '#/lib/image-url'

/**
 * Watch one clip, and decide about it here (#658).
 *
 * **Delete is in the player because that is where the judgement happens.**
 * Clips out of one prompt look alike on a wall and unalike the moment they
 * run, so the cull is: open, watch five seconds, know. Closing the dialog to
 * find the same clip's `...` menu is the whole cost of tidying, and the
 * workaround before this was renaming a clip to say it should go.
 *
 * **No confirmation, and that is deliberate.** Delete moves the row to Trash
 * -- the same call the card's menu makes, which has never asked either. A
 * prompt here would be the only place in the app that asks before a
 * recoverable act, and it doubles the clicks in the one loop that is all
 * clicks.
 */
export function VideoPlayerDialog({
  video,
  onClose,
  onDelete,
}: {
  video: VideoRecord | null
  onClose: () => void
  /** Move this clip to Trash. The dialog closes; the wall drops the card. */
  onDelete: (id: string) => void
}) {
  const name = video ? clipName(video) : null

  return (
    <Dialog
      open={!!video}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={styles.dialog}>
        {/* The clip's own name when it has one, rather than the same two words
            over every clip. The dialog still has to be titled, so the generic
            line is the fallback and not a second heading. */}
        <DialogTitle>{name ?? 'Video playback'}</DialogTitle>
        {video && <Player key={video.id} video={video} />}
        {video && (
          <div className={styles.actions}>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onDelete(video.id)
                onClose()
              }}
            >
              <Trash2 size={14} />
              Delete this video
            </Button>
          </div>
        )}
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
