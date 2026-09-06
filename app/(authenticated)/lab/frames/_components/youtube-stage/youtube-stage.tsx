'use client'

import { useEffect, useRef } from 'react'
import styles from './youtube-stage.module.css'
import type { RefObject } from 'react'

/** Only the four members this page uses. The IFrame API's surface is large and
 *  a dependency for its types would be a package for four lines. */
export interface YouTubePlayer {
  getCurrentTime: () => number
  getDuration: () => number
  getVideoData: () => { title?: string }
  destroy: () => void
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars?: Record<string, number | string>
      events?: { onReady?: () => void; onError?: () => void }
    },
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api'

/**
 * The API script, loaded once for the life of the tab.
 *
 * A module-level promise rather than per-mount state: the script installs a
 * single global callback, so two components racing to add it would have the
 * second overwrite the first's `onYouTubeIframeAPIReady` and one of them would
 * wait forever.
 */
let apiPromise: Promise<YouTubeApi> | null = null

function loadApi(): Promise<YouTubeApi> {
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    // Chained rather than assigned: something else on the page may already be
    // waiting on this callback, and the API only ever calls it once.
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('The YouTube player failed to load'))
    }

    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onerror = () => reject(new Error('Could not reach YouTube'))
    document.head.appendChild(script)
  }).catch((err: unknown) => {
    // A failed load must not be cached as a permanent verdict -- the next
    // attempt should get to try the network again.
    apiPromise = null
    throw err
  })

  return apiPromise
}

/**
 * A YouTube video in the stage, as a real player.
 *
 * **It gives up a timestamp and never a pixel.** A cross-origin iframe cannot be
 * drawn to a canvas, so the capture the clip half of this page does is
 * impossible here — but `getCurrentTime()` is exact, and the server can seek the
 * same source to the same position. Scrub or play, press the button, and the
 * frame that was on screen comes back from the server.
 *
 * The player is exposed through `playerRef` rather than an event, because what
 * the caller needs is the position *at the moment of the click* — a value
 * pushed on every frame would be a render loop for a number that is only ever
 * read once.
 */
export function YouTubeStage({
  videoId,
  playerRef,
  onTitle,
  onError,
}: {
  videoId: string
  playerRef: RefObject<YouTubePlayer | null>
  /** The video's real title, once the player knows it. Until then the caller
   *  has only the id to show. */
  onTitle?: (title: string) => void
  onError?: (message: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // Effect callbacks that should not re-create the player when the parent
  // re-renders with new function identities.
  const onTitleRef = useRef(onTitle)
  const onErrorRef = useRef(onError)
  onTitleRef.current = onTitle
  onErrorRef.current = onError

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let player: YouTubePlayer | null = null
    let cancelled = false

    // The API replaces the element it is handed with an iframe, so it gets a
    // fresh child each time rather than the host itself -- which React owns and
    // would otherwise find missing on unmount.
    const mount = document.createElement('div')
    host.appendChild(mount)

    void loadApi()
      .then((api) => {
        if (cancelled) return
        player = new api.Player(mount, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            // Muted always. This page watches a video to find a picture in it
            // -- the sound is never the thing being judged, and an unmuted
            // autoplay-adjacent embed is a surprise nobody wants. It also lets
            // the browser treat playback as cheap.
            mute: 1,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              playerRef.current = player
              const title = player?.getVideoData().title
              if (title) onTitleRef.current?.(title)
            },
            onError: () => {
              if (cancelled) return
              onErrorRef.current?.(
                'That video will not play here — it may not allow embedding.',
              )
            },
          },
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        onErrorRef.current?.(
          err instanceof Error ? err.message : 'Could not load the player',
        )
      })

    return () => {
      cancelled = true
      playerRef.current = null
      player?.destroy()
      mount.remove()
    }
  }, [videoId, playerRef])

  return <div ref={hostRef} className={styles.stage} />
}
