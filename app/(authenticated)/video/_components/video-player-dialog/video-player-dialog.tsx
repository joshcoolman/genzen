'use client'

import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import styles from './video-player-dialog.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { Button, Dialog, DialogContent, DialogTitle, Input } from '#/components'
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
 * **The title is edited in place, in the header** (#657). The same five
 * seconds that say "this one goes" say what the keeper is called, and sending
 * that to a modal over a modal -- or back out to the card's menu -- is the
 * detour this dialog is supposed to remove.
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
  onRename,
}: {
  video: VideoRecord | null
  onClose: () => void
  /** Move this clip to Trash. The dialog closes; the wall drops the card. */
  onDelete: (id: string) => void
  /** Name this clip, from the header. */
  onRename: (video: VideoRecord, title: string) => void
}) {
  return (
    <Dialog
      open={!!video}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={styles.dialog}>
        {/* Both keyed on the clip so they reset when it changes, and each with
            its own prefix: siblings sharing one key is the duplicate-key
            warning React raised on every open. */}
        {video ? (
          <TitleRow
            key={`title-${video.id}`}
            video={video}
            onRename={(title) => onRename(video, title)}
          />
        ) : (
          <DialogTitle>Video playback</DialogTitle>
        )}
        {video && <Player key={`player-${video.id}`} video={video} />}
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

/**
 * The clip's name, editable where it is read.
 *
 * Keyed on the clip in the caller, so opening a different one cannot arrive
 * with the last clip's half-typed name in the field.
 *
 * **The heading survives editing, hidden.** A dialog's accessible name comes
 * from `DialogTitle`; swapping it for an input would leave the dialog nameless
 * for exactly as long as someone is typing in it.
 */
function TitleRow({
  video,
  onRename,
}: {
  video: VideoRecord
  onRename: (title: string) => void
}) {
  const name = clipName(video)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name ?? '')

  const trimmed = draft.trim()

  const save = () => {
    if (!trimmed) return
    onRename(trimmed)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(name ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className={styles.titleRow}>
        {/* The name when it has one. The generic line is a fallback, not a
            second heading over every clip. */}
        <DialogTitle>{name ?? 'Video playback'}</DialogTitle>
        <button
          type="button"
          className={styles.edit}
          onClick={() => setEditing(true)}
          aria-label={name ? 'Rename this clip' : 'Name this clip'}
          title={name ? 'Rename this clip' : 'Name this clip'}
        >
          <Pencil size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className={styles.titleRow}>
      <DialogTitle className={styles.hiddenTitle}>
        {name ?? 'Video playback'}
      </DialogTitle>
      <Input
        autoFocus
        className={styles.titleInput}
        value={draft}
        placeholder="Name this clip"
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') {
            // Stopped, or Escape closes the dialog and the clip with it --
            // cancelling a name is not asking to stop watching.
            e.preventDefault()
            e.stopPropagation()
            cancel()
          }
        }}
      />
      <button
        type="button"
        className={styles.edit}
        onClick={save}
        disabled={!trimmed}
        aria-label="Save name"
        title="Save name"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        className={styles.edit}
        onClick={cancel}
        aria-label="Cancel"
        title="Cancel"
      >
        <X size={14} />
      </button>
    </div>
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
