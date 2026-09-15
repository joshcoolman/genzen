'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  clipFrameGrid,
  grabClipFrame,
  importedClipFrames,
} from '../../_actions/clip-frames.action'
import styles from './frame-grid-dialog.module.css'
import type { ClipFrameGridView } from '../../_actions/clip-frames.action'
import type { VideoRecord } from '../../_actions/generate-video.action'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { stampFrameSource } from '#/features/video/server/stamp-frame.action'
import {
  Button,
  ClipFrameGrid,
  Dialog,
  DialogContent,
  DialogTitle,
  markedFrameIndexes,
  toast,
} from '#/components'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'

/** PNG bytes from the server, as the `File` the library takes. */
function fileFromBase64(base64: string, name: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: 'image/png' })
}

/**
 * A clip's frames, start to finish, and the ones worth keeping (#647).
 *
 * **The tiles are `ClipFrameGrid`**, shared with Director's reference picker
 * (#665); this dialog is the loading, the import and the rule that an imported
 * tile is out of bounds.
 *
 * **Selection is the whole interaction.** No scrubbing, no timeline, no
 * precision: the grid answers "which of these is the shot", and `lab/frames`
 * is still the tool for an exact position. Import re-extracts the chosen
 * timestamps at full resolution, one at a time, and each lands in the library
 * through `saveFileToLibrary` like any other upload.
 *
 * **A tile already imported is marked and cannot be picked.** The provenance
 * stamp is read back on open, so pressing Import twice on a clip does not put
 * the same picture in the library twice.
 */
export function FrameGridDialog({
  clip,
  onClose,
}: {
  clip: VideoRecord | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!clip}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={styles.dialog}>
        <DialogTitle>Grab frames</DialogTitle>
        {clip && <Grid key={clip.id} clip={clip} />}
      </DialogContent>
    </Dialog>
  )
}

function Grid({ clip }: { clip: VideoRecord }) {
  const { user } = useAuth()

  const [grid, setGrid] = useState<ClipFrameGridView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<Array<number>>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    let live = true

    /* The sheet and the stamps together: both are wanted before anything can
       be drawn, and the sheet is the slow one only on a clip nobody has opened
       before. */
    void Promise.all([
      clipFrameGrid({ clipId: clip.id }),
      importedClipFrames({ clipId: clip.id }).catch(() => []),
    ])
      .then(([view, frames]) => {
        if (!live) return
        setGrid(view)
        setImported(frames.map((frame) => frame.timeSeconds))
      })
      .catch((err: unknown) => {
        if (live) setError((err as Error).message)
      })

    return () => {
      live = false
    }
  }, [clip.id])

  const marked = useMemo(
    () => markedFrameIndexes(grid?.times ?? [], imported),
    [grid, imported],
  )

  const toggle = (index: number) => {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  /* Serial, and the count moves as each one lands. Ten parallel calls are ten
     downloads of the same clip and ten ffmpeg processes; in order they are one
     at a time and the progress is honest. */
  const importPicked = async () => {
    if (!grid || picked.size === 0) return
    const times = [...picked].sort((a, b) => a - b).map((i) => grid.times[i])

    setDone(0)
    let landed = 0
    try {
      for (const timeSeconds of times) {
        const frame = await grabClipFrame({ clipId: clip.id, timeSeconds })
        const image = await saveFileToLibrary({
          userId: user.id,
          file: fileFromBase64(
            frame.base64,
            `frame-${timeSeconds.toFixed(2)}.png`,
          ),
          title: `Frame · ${clip.title}`,
          description: clip.description,
        })

        // Best-effort, as it is everywhere else: a frame without its origin
        // stamped is still a usable image, and losing the import over the
        // stamp would be the wrong trade. It is what marks the tile, so a
        // failure here costs the marker and nothing else.
        void stampFrameSource({
          imageId: image.id,
          clipId: clip.id,
          timeSeconds,
          kind: 'grid',
        }).catch(() => {})

        landed += 1
        setDone(landed)
        setImported((current) => [...current, timeSeconds])
      }

      setPicked(new Set())
      toast.success(
        landed === 1
          ? 'Frame added to Images'
          : `${landed} frames added to Images`,
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDone(null)
    }
  }

  if (error) {
    return (
      <p className={styles.state} role="alert">
        {error}
      </p>
    )
  }

  if (!grid) {
    return (
      <p className={styles.state}>
        <Loader2 className={styles.spinner} size={16} />
        Sampling frames…
      </p>
    )
  }

  const count = grid.times.length
  const sheet = imageUrl(clip.id, 'frames')
  const busy = done !== null

  return (
    <>
      <ClipFrameGrid
        className={styles.grid}
        sheetUrl={sheet}
        times={grid.times}
        tileWidth={grid.tileWidth}
        tileHeight={grid.tileHeight}
        selected={picked}
        marked={marked}
        /* Imported already: there is nothing left to do with it here, unlike
           in Director where that row is exactly what gets reused. */
        lockMarked
        busy={busy}
        onToggle={toggle}
      />

      <div className={styles.footer}>
        <p className={styles.count}>
          {busy
            ? `Importing ${done + 1} of ${picked.size}…`
            : picked.size > 0
              ? `${picked.size} selected`
              : `${count} frames`}
        </p>
        <Button
          onClick={() => void importPicked()}
          disabled={picked.size === 0 || busy}
        >
          {busy ? <Loader2 className={styles.spinner} size={14} /> : null}
          Import to Images
        </Button>
      </div>
    </>
  )
}
