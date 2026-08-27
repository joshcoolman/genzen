import { domToBlob } from 'modern-screenshot'

/**
 * Drawing a picture of the app as it currently stands, from the browser, with
 * no native tools and no browser extension.
 *
 * **Headless on purpose.** Nothing here knows about a button, a dialog or a
 * route. The probe in the app chrome is one caller; the intended second one is
 * a tool a conversational agent invokes, at which point there is no UI in the
 * loop at all. Keeping the mechanism free of both is the whole reason this is
 * a module and not a hook.
 *
 * **It is a re-render, not a photograph.** The browser never captures a pixel
 * of the screen: every element's computed style is inlined into a copy of the
 * markup, that copy is wrapped in an SVG `foreignObject`, and the browser is
 * asked to paint it into a canvas. That it comes out identical is a fact about
 * this app -- plain CSS Modules, flex, grid, `<img>` -- rather than a guarantee
 * of the method. What a copy cannot carry comes out wrong and comes out wrong
 * *silently*: `mix-blend-mode`, `backdrop-filter`, `<canvas>` contents,
 * cross-origin images, some masks. Nothing throws; the picture is just not the
 * page. Worth knowing before trusting one of these unseen.
 *
 * `toBlob` is only allowed because images come from `/img/[id]`, our own
 * origin. A picture served from FAL's URL would taint the canvas and throw --
 * the same constraint `src/features/video`'s frame capture works under.
 *
 * Callers must revoke the object URLs.
 */
export async function captureView(): Promise<CapturedView> {
  // Both framings from the one moment, deliberately. Captured separately they
  // are pictures of two different states -- a generation lands, a poll
  // resolves -- and comparing framings while the content shifts underneath is
  // a confusing thing to debug later.
  const [viewport, content] = await Promise.all([
    grab('viewport'),
    grab('content'),
  ])
  return { viewport, content }
}

/** What is on screen, and what exists. */
export type CaptureTarget = 'viewport' | 'content'

export type CapturedView = Record<CaptureTarget, CapturedShot>

export interface CapturedShot {
  blob: Blob
  /** Object URL for the blob. The caller revokes it. */
  url: string
  width: number
  height: number
  bytes: number
  ms: number
}

/**
 * The two framings are two kinds of context, not two sizes of one.
 *
 * `viewport` carries **attention**: scroll position is intent, and no schema
 * has a field for what someone is currently looking at. It draws
 * `document.body` clipped to what is on screen -- the library renders a node
 * at its full height, so the clip is a size plus a translate by the scroll
 * offset. That translate is a no-op on today's routes, where the chrome is
 * viewport-height and scrolling happens in panels inside it, and is correct on
 * any route that ever scrolls the document.
 *
 * `content` carries the surface without the chrome: `<main>` at its natural
 * height, no rail. Whether the rail is context or noise is one of the things
 * the probe exists to settle.
 */
async function grab(target: CaptureTarget): Promise<CapturedShot> {
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
  })

  const bitmap = await createImageBitmap(blob)
  return {
    blob,
    url: URL.createObjectURL(blob),
    width: bitmap.width,
    height: bitmap.height,
    bytes: blob.size,
    ms: Math.round(performance.now() - started),
  }
}
