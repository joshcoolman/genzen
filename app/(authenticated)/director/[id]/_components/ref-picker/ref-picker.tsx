'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import {
  clipFrameGrid,
  grabClipFrame,
  importedClipFrames,
} from '../../../../video/_actions/clip-frames.action'
import styles from './ref-picker.module.css'
import type { GenFrame } from '../gen-form/gen-form'
import type {
  ClipFrameGridView,
  ImportedClipFrame,
} from '../../../../video/_actions/clip-frames.action'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { clipName } from '#/features/video/clip-facts'
import { stampFrameSource } from '#/features/video/server/stamp-frame.action'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import {
  Button,
  ClipFrameGrid,
  ClipFrames,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  markedFrameIndexes,
  toast,
} from '#/components'

/** Two timestamps are the same tile within this much -- `ClipFrameGrid`'s own
 *  tolerance, applied here to find the row a tile already has. */
const SAME_TIME = 0.05

/** The edge of one frame in a clip tile. A pair is twice this wide. */
const TILE = 104

/** PNG bytes from the server, as the `File` the library takes. */
function fileFromBase64(base64: string, name: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: 'image/png' })
}

/**
 * Pull a frame out of an earlier clip, so a prompt can name what left the shot
 * (#665).
 *
 * **The clip first, then the frame, and that order is the whole design.** A run
 * drifts the moment a clip moves away from what came before it: by the third
 * one the worker and the floor he was on are in neither the last frame nor the
 * request, and "cut back to the worker" is a description with nothing behind
 * it. The picture that fixes it already exists, in an earlier clip -- and what
 * you remember is *which clip he was in*, never which frame id he is on. So
 * step one is the run, drawn as the tiles the row draws, and step two is that
 * clip's own contact sheet.
 *
 * **A tile the library already holds is reused, not cut again.** Grab frames
 * stamps every still it imports with the clip and the second it came from, so a
 * frame picked twice is one row rather than two identical PNGs -- the same
 * provenance-before-bytes rule `findClipEndFrame` follows for a clip's ending.
 * A tile with no row behind it is extracted at full resolution and lands in the
 * library like any other upload, which is what makes it addressable as a
 * reference at all.
 *
 * **It carries identity and look, not framing.** Who the worker is, what that
 * warehouse light is like -- "tight shot" stays the prompt's job.
 */
export function RefPicker({
  open,
  onOpenChange,
  clips,
  remaining,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The run's finished clips, in run order. */
  clips: Array<VideoRecord>
  /** How many more references this clip may carry. */
  remaining: number
  onAdd: (frames: Array<GenFrame>) => void
}) {
  const [clip, setClip] = useState<VideoRecord | null>(null)

  // Back to step one on every open: the clip you wanted last time is rarely the
  // clip you want now, and a dialog that reopens mid-flow hides the choice it
  // exists to ask.
  useEffect(() => {
    if (open) setClip(null)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>
            {clip ? 'Pick frames' : 'Which clip is it in?'}
          </DialogTitle>
        </DialogHeader>

        {clip ? (
          <Frames
            key={clip.id}
            clip={clip}
            remaining={remaining}
            onBack={() => setClip(null)}
            onAdd={(frames) => {
              onAdd(frames)
              onOpenChange(false)
            }}
          />
        ) : (
          <ClipStep clips={clips} onPick={setClip} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Step one: the run, as the row draws it. Both ends of every clip, because
 *  which clip the worker was in is answered by looking at them. */
function ClipStep({
  clips,
  onPick,
}: {
  clips: Array<VideoRecord>
  onPick: (clip: VideoRecord) => void
}) {
  if (clips.length === 0) {
    return (
      <p className={styles.state}>
        No finished clips in this run to take a frame from yet.
      </p>
    )
  }

  return (
    <div className={styles.clips}>
      {clips.map((clip, index) => (
        <button
          key={clip.id}
          type="button"
          className={styles.clip}
          onClick={() => onPick(clip)}
        >
          <ClipFrames clip={clip} size={TILE} alt={clip.title} />
          <span className={styles.clipName}>
            {index + 1}. {clipName(clip) ?? clip.title}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Step two: that clip's contact sheet, and the rows the chosen tiles become. */
function Frames({
  clip,
  remaining,
  onBack,
  onAdd,
}: {
  clip: VideoRecord
  remaining: number
  onBack: () => void
  onAdd: (frames: Array<GenFrame>) => void
}) {
  const { user } = useAuth()

  const [grid, setGrid] = useState<ClipFrameGridView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<Array<ImportedClipFrame>>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    let live = true

    void Promise.all([
      clipFrameGrid({ clipId: clip.id }),
      importedClipFrames({ clipId: clip.id }).catch(
        () => [] as Array<ImportedClipFrame>,
      ),
    ])
      .then(([view, frames]) => {
        if (!live) return
        setGrid(view)
        setImported(frames)
      })
      .catch((err: unknown) => {
        if (live) setError((err as Error).message)
      })

    return () => {
      live = false
    }
  }, [clip.id])

  /* Marked here means "already a row", which is information rather than a
     prohibition -- the opposite of Grab frames, where importing a tile twice is
     the thing to prevent. So `lockMarked` is off and the tick reads as free. */
  const marked = useMemo(
    () =>
      markedFrameIndexes(
        grid?.times ?? [],
        imported.map((frame) => frame.timeSeconds),
      ),
    [grid, imported],
  )

  const full = picked.size >= remaining

  const toggle = (index: number) => {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else if (current.size < remaining) next.add(index)
      return next
    })
  }

  const existingRow = (time: number): string | undefined =>
    imported.find((frame) => Math.abs(frame.timeSeconds - time) < SAME_TIME)
      ?.imageId

  /* Serial, and the count moves as each one lands -- `FrameGridDialog`'s rule:
     parallel calls are several downloads of the same clip and several ffmpeg
     processes, where in order they are one at a time and the progress is
     honest. A tile that already has a row costs neither. */
  const use = async () => {
    if (!grid || picked.size === 0) return
    const times = [...picked].sort((a, b) => a - b).map((i) => grid.times[i])
    const title = `Frame · ${clip.title}`

    setDone(0)
    const frames: Array<GenFrame> = []
    try {
      for (const timeSeconds of times) {
        const existing = existingRow(timeSeconds)
        if (existing) {
          frames.push({ id: existing, url: imageUrl(existing, 'thumb'), title })
          setDone(frames.length)
          continue
        }

        const frame = await grabClipFrame({ clipId: clip.id, timeSeconds })
        const image = await saveFileToLibrary({
          userId: user.id,
          file: fileFromBase64(
            frame.base64,
            `frame-${timeSeconds.toFixed(2)}.png`,
          ),
          title,
          description: clip.description,
        })

        // Best-effort, as everywhere else this stamp is written: a frame whose
        // origin failed to record is still a usable reference, and the only
        // cost is that picking the same tile again cuts it a second time.
        void stampFrameSource({
          imageId: image.id,
          clipId: clip.id,
          timeSeconds,
          kind: 'grid',
        }).catch(() => {})

        frames.push({
          id: image.id,
          url: imageUrl(image.id, 'thumb'),
          title: image.title,
        })
        setDone(frames.length)
      }

      onAdd(frames)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDone(null)
    }
  }

  const busy = done !== null

  return (
    <>
      {error ? (
        <p className={styles.state} role="alert">
          {error}
        </p>
      ) : !grid ? (
        <p className={styles.state}>
          <Loader2 className={styles.spinner} size={16} />
          Sampling frames…
        </p>
      ) : (
        <ClipFrameGrid
          className={styles.grid}
          sheetUrl={imageUrl(clip.id, 'frames')}
          times={grid.times}
          tileWidth={grid.tileWidth}
          tileHeight={grid.tileHeight}
          selected={picked}
          marked={marked}
          busy={busy}
          onToggle={toggle}
        />
      )}

      <div className={styles.footer}>
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ChevronLeft size={14} />
          Clips
        </Button>
        <p className={styles.count}>
          {busy
            ? `Adding ${done + 1} of ${picked.size}…`
            : full
              ? `${picked.size} selected, the most this clip takes`
              : `${picked.size} of ${remaining}`}
        </p>
        <Button onClick={() => void use()} disabled={picked.size === 0 || busy}>
          {busy ? <Loader2 className={styles.spinner} size={14} /> : null}
          Use as reference
        </Button>
      </div>
    </>
  )
}
