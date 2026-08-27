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
 * Nothing here is saved. The blob lives in an object URL for as long as the
 * dialog is open and is revoked when it closes. No row, no bucket, no library
 * entry -- the tail of that already exists (`saveFileToLibrary`, see
 * `images/_hooks/use-uploads.ts`) and deliberately is not wired up, because
 * the thing being judged is the picture, not the plumbing.
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
  const [shot, setShot] = useState<Shot | null>(null)
  const [busy, setBusy] = useState(false)

  const capture = useCallback(async (target: Target) => {
    setBusy(true)
    try {
      setShot(await grab(target))
    } catch (error) {
      console.error('[screenshot-probe]', error)
      setShot(null)
    } finally {
      setBusy(false)
    }
  }, [])

  // The object URL outlives no dialog. Revoked on replacement and on close.
  useEffect(() => {
    if (!shot) return
    return () => URL.revokeObjectURL(shot.url)
  }, [shot])

  return (
    <>
      <button
        type="button"
        data-screenshot-probe
        className={styles.trigger}
        onClick={() => capture('viewport')}
        disabled={busy}
        title="Screenshot probe"
        aria-label="Screenshot probe"
      >
        <Camera size={16} />
      </button>

      <Dialog
        open={shot !== null}
        onOpenChange={(open) => !open && setShot(null)}
      >
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Screenshot probe</DialogTitle>
          </DialogHeader>
          {shot && (
            <div className={styles.body}>
              <p className={styles.facts}>
                {shot.target} &middot; {shot.width}&times;{shot.height} &middot;{' '}
                {Math.round(shot.bytes / 1024)} KB &middot; {shot.ms} ms
              </p>
              {/* A blob URL, not a library image -- next/image would want a
                  loader for it and there is nothing to optimise. */}
              <img
                src={shot.url}
                alt="Captured page"
                className={styles.preview}
              />
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  onClick={() => capture('viewport')}
                  disabled={busy}
                >
                  Whole viewport
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => capture('content')}
                  disabled={busy}
                >
                  Content only
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

type Target = 'viewport' | 'content'

interface Shot {
  url: string
  target: Target
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
    target,
    width: bitmap.width,
    height: bitmap.height,
    bytes: blob.size,
    ms: Math.round(performance.now() - started),
  }
}
