'use client'

import { Camera } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import styles from './screenshot-probe.module.css'
import type {CaptureTarget, CapturedView} from '#/lib/capture-view';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components'
import {
  
  
  captureView
} from '#/lib/capture-view'

/**
 * A throwaway probe for one question: **can the app draw a picture of itself
 * that is worth sending to a model?**
 *
 * Nothing is saved. The blobs live in object URLs until the dialog closes.
 * No row, no bucket, no library entry -- the tail of that already exists
 * (`saveFileToLibrary`, see `images/_hooks/use-uploads.ts`) and deliberately is
 * not wired up, because the thing being judged is the picture, not the
 * plumbing. If a rasterized genzen route does not look like genzen, the rest of
 * the idea is moot and this folder deletes in one commit.
 *
 * It sits in the rail rather than floating, so it is available from every
 * route without being a fixed thing overlapping each of them -- the point is to
 * walk around the app pressing it. The mechanism is `#/lib/capture-view`, which
 * knows nothing about this dialog: the intended second caller is a tool a
 * conversational agent invokes, with no UI in the loop at all.
 *
 * **One press captures both framings**, and the dialog only toggles between
 * blobs it already holds. Capturing on demand from inside the dialog was the
 * first shape and was wrong twice over: the dialog portals into
 * `document.body`, so a viewport re-capture drew its own backdrop instead of
 * the page, and closing it for a frame first still left the two pictures
 * showing two different moments.
 */
export function ScreenshotProbe({ className }: { className?: string }) {
  const [run, setRun] = useState<CapturedView | null>(null)
  const [target, setTarget] = useState<CaptureTarget>('viewport')
  const [busy, setBusy] = useState(false)

  const capture = useCallback(async () => {
    setBusy(true)
    try {
      setTarget('viewport')
      setRun(await captureView())
    } catch (error) {
      console.error('[screenshot-probe]', error)
      setRun(null)
    } finally {
      setBusy(false)
    }
  }, [])

  // The object URLs outlive no dialog. Revoked when the run is replaced or the
  // dialog closes.
  useEffect(() => {
    if (!run) return
    return () => {
      URL.revokeObjectURL(run.viewport.url)
      URL.revokeObjectURL(run.content.url)
    }
  }, [run])

  const shot = run?.[target]

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" />}
          onClick={() => void capture()}
          disabled={busy}
          className={className}
        >
          <Camera className={styles.icon} />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Screenshot probe
        </TooltipContent>
      </Tooltip>

      <Dialog
        open={run !== null}
        onOpenChange={(open) => !open && setRun(null)}
      >
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Screenshot probe</DialogTitle>
          </DialogHeader>
          {shot && (
            <div className={styles.body}>
              <div className={styles.actions}>
                <Button
                  variant={target === 'viewport' ? 'primary' : 'secondary'}
                  onClick={() => setTarget('viewport')}
                >
                  Whole viewport
                </Button>
                <Button
                  variant={target === 'content' ? 'primary' : 'secondary'}
                  onClick={() => setTarget('content')}
                >
                  Content only
                </Button>
              </div>
              <p className={styles.facts}>
                {shot.width}&times;{shot.height} &middot;{' '}
                {Math.round(shot.bytes / 1024)} KB &middot; {shot.ms} ms
              </p>
              {/* A blob URL, not a library image -- next/image would want a
                  loader for it and there is nothing to optimise. */}
              <img
                src={shot.url}
                alt="Captured page"
                className={styles.preview}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
