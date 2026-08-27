'use client'

import { domToBlob } from 'modern-screenshot'
import { Camera } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import styles from './screenshot-probe.module.css'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components'

/**
 * A throwaway probe for one question: **can the app draw a picture of itself
 * that is worth sending to a model?**
 *
 * Nothing here is saved. The blobs live in object URLs for as long as the
 * dialog is open and are revoked when it closes. No row, no bucket, no library
 * entry -- the tail of that already exists (`saveFileToLibrary`, see
 * `images/_hooks/use-uploads.ts`) and deliberately is not wired up, because
 * the thing being judged is the picture, not the plumbing.
 *
 * **Both framings are captured on the one press, and the dialog only toggles
 * between them.** Capturing on demand from inside the open dialog was the
 * first shape and it was wrong twice over: the dialog portals into
 * `document.body`, so a `viewport` re-capture walked into its own backdrop and
 * drew that instead of the page, and even with the dialog closed for the frame
 * the two pictures were then of two different moments. One press, one moment,
 * two crops of it.
 *
 * Viewport only, on purpose. Everything on screen is already rendered and
 * decoded, so the two problems that make full-page capture hard -- virtualised
 * rows that are not in the DOM, and `loading="lazy"` images that have no bytes
 * -- cannot arise. Below the fold is not what anyone points at.
 *
 * `toBlob` on the canvas is only allowed because images come from `/img/[id]`,
 * our own origin. A picture served from FAL's URL would taint it and throw --
 * the same constraint Frames works under.
 */
export function ScreenshotProbe() {
  const [run, setRun] = useState<Run | null>(null)
  const [target, setTarget] = useState<Target>('viewport')
  const [busy, setBusy] = useState(false)

  const capture = useCallback(async () => {
    setBusy(true)
    try {
      const [viewport, content] = await Promise.all([
        grab('viewport'),
        grab('content'),
      ])
      setTarget('viewport')
      setRun({ viewport, content })
    } catch (error) {
      console.error('[screenshot-probe]', error)
      setRun(null)
    } finally {
      setBusy(false)
    }
  }, [])

  // The object URLs outlive no dialog. Revoked when the run is replaced or
  // the dialog closes.
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
      <button
        type="button"
        data-screenshot-probe
        className={styles.trigger}
        onClick={() => void capture()}
        disabled={busy}
        title="Screenshot probe"
        aria-label="Screenshot probe"
      >
        <Camera size={16} />
      </button>

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

type Target = 'viewport' | 'content'

type Run = Record<Target, Shot>

interface Shot {
  url: string
  width: number
  height: number
  bytes: number
  ms: number
}

/**
 * Two framings worth comparing, which is the second question the probe answers:
 * is the nav rail context or noise?
 *
 * `viewport` draws `document.body` clipped to what is on screen. The library
 * renders a node at its full height, so the clip is a size plus a translate by
 * the scroll offset -- which is a no-op on this app's routes, where the chrome
 * is viewport-height and the scrolling happens in panels inside it, but is
 * correct on any route that ever scrolls the document.
 *
 * `content` draws `<main>` instead, and takes its full height rather than
 * clipping -- a route's own scroller is inside it, so its rendered height is
 * already only what exists.
 */
async function grab(target: Target): Promise<Shot> {
  const started = performance.now()
  const node =
    target === 'content'
      ? (document.querySelector('main') ?? document.body)
      : document.body

  const clip =
    target === 'viewport'
      ? {
          width: window.innerWidth,
          height: window.innerHeight,
          style: {
            transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
          },
        }
      : {}

  const blob = await domToBlob(node, {
    ...clip,
    // Retina. Half this and the model badges on a card stop being legible,
    // which is the whole point of the picture.
    scale: 2,
    // The body's own paint, so the capture is not transparent where the app
    // relies on the document's background showing through.
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    // The probe must not photograph itself.
    filter: (n: Node) =>
      !(n instanceof Element && n.hasAttribute('data-screenshot-probe')),
  })

  const bitmap = await createImageBitmap(blob)
  return {
    url: URL.createObjectURL(blob),
    width: bitmap.width,
    height: bitmap.height,
    bytes: blob.size,
    ms: Math.round(performance.now() - started),
  }
}
