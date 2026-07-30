'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  centerOn,
  scaleToFit,
} from '../_lib/geometry'
import type { Bounds } from '../_lib/geometry'
import type { Transform } from '../_lib/types'

interface UseViewportArgs {
  initial: Transform | null | undefined
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Space-to-pan is suppressed while a dialog owns the keyboard. */
  dialogOpenRef: React.RefObject<boolean>
}

/** Pan, zoom and the screen<->canvas coordinate conversion.
 *
 *  `tRef` mirrors `transform` because wheel and drag handlers read the current
 *  value on every event and must not re-subscribe to do it; they write both the
 *  ref and the state so the render stays in step. */
export function useViewport({
  initial,
  containerRef,
  dialogOpenRef,
}: UseViewportArgs) {
  const [transform, setTransform] = useState<Transform>(
    initial ?? { x: 0, y: 0, scale: DEFAULT_SCALE },
  )
  const [spaceHeld, setSpaceHeld] = useState(false)

  const tRef = useRef(transform)
  const spaceRef = useRef(false)

  useEffect(() => {
    tRef.current = transform
  }, [transform])

  const screenToCanvas = useCallback(
    (sx: number, sy: number) => {
      const r = containerRef.current?.getBoundingClientRect()
      if (!r) return { x: 0, y: 0 }
      const t = tRef.current
      return {
        x: (sx - r.left - t.x) / t.scale,
        y: (sy - r.top - t.y) / t.scale,
      }
    },
    [containerRef],
  )

  const viewportCenter = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return screenToCanvas(r.left + r.width / 2, r.top + r.height / 2)
  }, [containerRef, screenToCanvas])

  const zoomAt = useCallback((newScale: number, sx: number, sy: number) => {
    setTransform((prev) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale))
      const r = s / prev.scale
      return { x: sx - (sx - prev.x) * r, y: sy - (sy - prev.y) * r, scale: s }
    })
  }, [])

  const zoomCenter = useCallback(
    (newScale: number) => {
      const r = containerRef.current?.getBoundingClientRect()
      if (!r) return
      zoomAt(newScale, r.left + r.width / 2, r.top + r.height / 2)
    },
    [containerRef, zoomAt],
  )

  const fitBounds = useCallback(
    (bounds: Bounds) => {
      const r = containerRef.current?.getBoundingClientRect()
      if (!r || bounds.w === 0 || bounds.h === 0) return
      setTransform(centerOn(bounds, r, scaleToFit(bounds, r, { pad: 60 })))
    },
    [containerRef],
  )

  /** Focus bounds at 75% of the viewport -- comfortable, not edge-to-edge. */
  const focusBounds = useCallback(
    (bounds: Bounds) => {
      const r = containerRef.current?.getBoundingClientRect()
      if (!r) return
      setTransform(centerOn(bounds, r, scaleToFit(bounds, r, { fill: 0.75 })))
    },
    [containerRef],
  )

  /* -- Wheel zoom -- */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const t = tRef.current
      const sensitivity = e.ctrlKey ? 0.01 : 0.002
      const delta = -e.deltaY * sensitivity
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * (1 + delta)))
      const r = ns / t.scale
      const nt = {
        x: e.clientX - (e.clientX - t.x) * r,
        y: e.clientY - (e.clientY - t.y) * r,
        scale: ns,
      }
      tRef.current = nt
      setTransform(nt)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef])

  /* -- Space key holds pan mode -- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (
        dialogOpenRef.current ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      )
        return
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        spaceRef.current = true
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        setSpaceHeld(false)
      }
    }
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
    }
  }, [dialogOpenRef])

  /** Pan by a screen-space delta. Writes the ref first so a drag reads its own
   *  latest position on the next event. */
  const panBy = useCallback((dx: number, dy: number) => {
    const t = tRef.current
    const nt = { x: t.x + dx, y: t.y + dy, scale: t.scale }
    tRef.current = nt
    setTransform(nt)
  }, [])

  return {
    transform,
    setTransform,
    tRef,
    spaceHeld,
    spaceRef,
    screenToCanvas,
    viewportCenter,
    zoomAt,
    zoomCenter,
    fitBounds,
    focusBounds,
    panBy,
  }
}
