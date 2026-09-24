'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react'

/** How long a press has to last before it is a hold rather than a click. */
const HOLD_MS = 180

/**
 * Press and hold plays a clip in place; let go and the still is back.
 *
 * Two surfaces show clips as stills and want to be watched without leaving --
 * the clip picker and the Video wall's card (#726) -- and both keep their
 * click for what it did. A press is a hold once `HOLD_MS` has passed, and a
 * hold is not a click: the `click` that ends one is swallowed by the caller
 * asking `consumeHold` first.
 *
 * The caller draws the `<video>`; this only says which id is held.
 */
export function useHoldToPlay() {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  const end = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setPlayingId(null)
  }, [])

  useEffect(() => end, [end])

  /** True once for the click that ends a hold, so the caller ignores it. */
  const consumeHold = useCallback(() => {
    const was = held.current
    held.current = false
    return was
  }, [])

  const handlersFor = useCallback(
    (id: string) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0) return
        held.current = false
        timer.current = setTimeout(() => {
          held.current = true
          setPlayingId(id)
        }, HOLD_MS)
      },
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      // A long press on touch is the context menu, which would end the hold.
      onContextMenu: (e: SyntheticEvent) => e.preventDefault(),
    }),
    [end],
  )

  return { playingId, handlersFor, consumeHold, end }
}
