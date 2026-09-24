'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
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
 *
 * **It walks the section** (#726). Left and Right, or the chevrons either
 * side of the clip, move to the previous or next clip on the wall in the
 * wall's own order; the cull loop is open one, judge, next, and closing to
 * click the next card was most of it. **The play state carries across.** A
 * clip you were watching hands over to the next one playing from its first
 * frame; one you had paused hands over paused. Space plays and pauses,
 * unless the native player has focus and does it itself. **The keys are
 * read first, on capture, whatever has focus** -- the loop is watch, key,
 * watch, and a focus manager deciding whether a key counts is exactly the
 * interruption it should not have. Only a name being typed keeps its keys. A clip that ran to
 * its end still counts as playing -- it stopped because it ran out, not
 * because you stopped it.
 *
 * **Delete moves on, it does not close.** Most generations do not make the
 * cut, so the loop is watch, delete, watch the next -- and a dialog that
 * closed on every delete would put a card click between each pair. Delete
 * and Backspace do it from the keyboard; the last clip wraps to the first;
 * the only clip closes the dialog, since there is nothing to move on to.
 */
export function VideoPlayerDialog({
  video,
  videos,
  onNavigate,
  onClose,
  onDelete,
  onRename,
}: {
  video: VideoRecord | null
  /** The section's playable clips in the wall's order: what Left and Right
   *  walk. */
  videos: Array<VideoRecord>
  onNavigate: (id: string) => void
  onClose: () => void
  /** Move this clip to Trash. The wall drops the card; the dialog moves on. */
  onDelete: (id: string) => void
  /** Name this clip, from the header. */
  onRename: (video: VideoRecord, title: string) => void
}) {
  const index = video ? videos.findIndex((v) => v.id === video.id) : -1
  const prev = index > 0 ? videos[index - 1] : null
  const next =
    index >= 0 && index < videos.length - 1 ? videos[index + 1] : null

  /* Whether the next clip should start on its own. Set by what the person
     did to this one, read by the one that replaces it. A ref, not state: the
     player is remounted per clip and reads it once, at mount. */
  const wantPlaying = useRef(true)
  const player = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (!video) wantPlaying.current = true
  }, [video])

  const go = useCallback(
    (target: VideoRecord | null) => {
      if (target) onNavigate(target.id)
    },
    [onNavigate],
  )

  /** Trash this clip and land on the next one, or the first from the last,
   *  or nowhere when it was the only one. Same play state either way. */
  const remove = useCallback(() => {
    if (!video) return
    onDelete(video.id)
    const after = next ?? (index > 0 ? videos[0] : null)
    if (after) onNavigate(after.id)
    else onClose()
  }, [video, next, index, videos, onDelete, onNavigate, onClose])

  useEffect(() => {
    if (!video) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Taken before the native player, whose arrows seek five seconds.
        e.preventDefault()
        go(e.key === 'ArrowLeft' ? prev : next)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        remove()
      } else if (e.key === ' ' && target !== player.current) {
        // With the player focused, Space is its own play/pause already.
        e.preventDefault()
        const el = player.current
        if (!el) return
        if (el.paused) void el.play().catch(() => {})
        else el.pause()
      }
    }
    /* Capture, not bubble: something inside the popup stops arrow keys on
       their way up (Space arrives, Left and Right do not), and the native
       player's own arrows seek five seconds when it has focus. First in line
       is the only place both are certain. */
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [video, prev, next, go, remove])

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
        {video && (
          <div className={styles.stage}>
            <button
              type="button"
              className={styles.step}
              onClick={() => go(prev)}
              // Never keeps focus: a click here followed by Space is play
              // or pause, not this button again.
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
              disabled={!prev}
              aria-label="Previous clip"
              title="Previous clip (Left)"
            >
              <ChevronLeft size={20} />
            </button>
            <Player
              key={`player-${video.id}`}
              video={video}
              autoPlay={wantPlaying.current}
              playerRef={player}
              onPlayingChange={(playing) => {
                wantPlaying.current = playing
              }}
            />
            <button
              type="button"
              className={styles.step}
              onClick={() => go(next)}
              // Never keeps focus: a click here followed by Space is play
              // or pause, not this button again.
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
              disabled={!next}
              aria-label="Next clip"
              title="Next clip (Right)"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
        {video && (
          <div className={styles.actions}>
            {videos.length > 1 && index >= 0 && (
              <span className={styles.position}>
                {index + 1} / {videos.length}
              </span>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={remove}
              title="Delete (Delete or Backspace)"
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

function Player({
  video,
  autoPlay,
  playerRef,
  onPlayingChange,
}: {
  video: VideoRecord
  autoPlay: boolean
  playerRef: React.MutableRefObject<HTMLVideoElement | null>
  /** What the person did: a pause is a pause, a run to the end is not. */
  onPlayingChange: (playing: boolean) => void
}) {
  const [failed, setFailed] = useState(false)
  return (
    <>
      <video
        ref={playerRef}
        className={styles.player}
        src={imageUrl(video.id)}
        poster={imageUrl(video.id, 'thumb')}
        controls
        autoPlay={autoPlay}
        playsInline
        onPlay={() => onPlayingChange(true)}
        onPause={(e) => {
          if (!e.currentTarget.ended) onPlayingChange(false)
        }}
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
