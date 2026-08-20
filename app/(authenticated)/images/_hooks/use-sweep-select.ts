'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** How far the pointer travels before a shift-press stops being a shift-click
 *  and becomes a sweep. Small enough that a deliberate drag commits at once,
 *  large enough that the hand-wobble in a click never does. */
const DRAG_THRESHOLD = 5

/** A card the sweep can hit, measured once at drag start. In page coordinates
 *  (client + scroll), so a mid-sweep scroll does not move the targets out from
 *  under the rectangle. */
interface SweepTarget {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

interface Point {
  x: number
  y: number
}

/** The marquee, in client coordinates -- it is drawn `position: fixed`, above
 *  the grid rather than inside it, so the grid's `zoom` never scales it. */
export interface SweepRect {
  left: number
  top: number
  width: number
  height: number
}

interface UseSweepSelectOptions {
  /** Only in select mode: something is already picked (#440). That is what
   *  keeps a stray shift-drag from doing anything while you are just looking. */
  enabled: boolean
  /** Every id the rectangle currently touches. Re-sent whole on each move, so
   *  it must add and never remove. */
  onSweep: (ids: Array<string>) => void
}

/**
 * Shift-drag across the grid to add what the rectangle touches (#440).
 *
 * Deliberately loose rather than a graphics-program marquee: the drag can
 * start on top of a card, hitting is intersection rather than containment, and
 * it only ever adds. Precision is the thing the gesture exists to avoid.
 *
 * Not implemented, on purpose: **auto-scroll at the viewport edge.** A sweep
 * covers one screenful. Scrolling during a drag would mean re-measuring every
 * card on every move, which is what the one measurement at drag start is
 * avoiding -- at a hundred cards it is the difference between a hit test and a
 * layout pass per frame. Ordinary wheel scrolling still works and the
 * rectangle stays anchored to the content, because the geometry below is in
 * page coordinates.
 *
 * Mouse and trackpad only. There is no Shift on touch, and every touch device
 * already has tap-to-toggle.
 */
export function useSweepSelect({ enabled, onSweep }: UseSweepSelectOptions) {
  const [rect, setRect] = useState<SweepRect | null>(null)

  const originRef = useRef<Point | null>(null)
  const targetsRef = useRef<Array<SweepTarget>>([])
  const committedRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  /** Set on pointerup so the click the browser fires next is swallowed -- a
   *  sweep that started on a card must not also toggle that card. Cleared by
   *  the next press as well as by the click it is waiting for: a sweep that
   *  ends where no click follows (the pointer leaves the window, the button
   *  comes up over the chrome) would otherwise leave it armed and eat an
   *  unrelated click much later. Caught in testing, where two sweeps in a row
   *  left the second one's flag standing. */
  const swallowClickRef = useRef(false)

  const onSweepRef = useRef(onSweep)
  useEffect(() => {
    onSweepRef.current = onSweep
  })

  const end = useCallback(() => {
    originRef.current = null
    targetsRef.current = []
    committedRef.current = false
    pointerIdRef.current = null
    setRect(null)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (!e.shiftKey || e.button !== 0 || e.pointerType === 'touch') return

      // One measurement, here. The grid does not reflow during a drag, so
      // calling getBoundingClientRect per card per pointer move would buy
      // nothing and cost a layout pass every frame.
      const targets: Array<SweepTarget> = []
      for (const el of e.currentTarget.querySelectorAll('[data-select-id]')) {
        const id = el.getAttribute('data-select-id')
        if (!id) continue
        const r = el.getBoundingClientRect()
        targets.push({
          id,
          left: r.left + window.scrollX,
          top: r.top + window.scrollY,
          right: r.right + window.scrollX,
          bottom: r.bottom + window.scrollY,
        })
      }
      if (targets.length === 0) return

      targetsRef.current = targets
      originRef.current = {
        x: e.clientX + window.scrollX,
        y: e.clientY + window.scrollY,
      }
      committedRef.current = false
      pointerIdRef.current = e.pointerId
    },
    [enabled],
  )

  // On the window rather than on the grid: a sweep routinely leaves the grid
  // (past the last row, out over the toolbar) and has to keep tracking, and
  // the pointer can come up anywhere.
  useEffect(() => {
    if (!enabled) return

    const onMove = (e: PointerEvent) => {
      const origin = originRef.current
      if (!origin || e.pointerId !== pointerIdRef.current) return

      const x = e.clientX + window.scrollX
      const y = e.clientY + window.scrollY

      if (!committedRef.current) {
        if (Math.hypot(x - origin.x, y - origin.y) < DRAG_THRESHOLD) return
        committedRef.current = true
        // A range the browser started before we took over.
        window.getSelection()?.removeAllRanges()
      }

      const left = Math.min(origin.x, x)
      const right = Math.max(origin.x, x)
      const top = Math.min(origin.y, y)
      const bottom = Math.max(origin.y, y)

      // Intersection, not containment -- clipping a corner is enough.
      const hits: Array<string> = []
      for (const t of targetsRef.current) {
        if (
          t.left < right &&
          t.right > left &&
          t.top < bottom &&
          t.bottom > top
        )
          hits.push(t.id)
      }
      if (hits.length > 0) onSweepRef.current(hits)

      setRect({
        left: left - window.scrollX,
        top: top - window.scrollY,
        width: right - left,
        height: bottom - top,
      })
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return
      if (committedRef.current) swallowClickRef.current = true
      end()
    }

    const onClick = (e: MouseEvent) => {
      if (!swallowClickRef.current) return
      swallowClickRef.current = false
      // `detail` is 0 for a click synthesised from the keyboard (Enter on a
      // focused button). Only the pointer's own click is the one to eat.
      if (e.detail === 0) return
      e.stopPropagation()
      e.preventDefault()
    }

    const onDown = () => {
      swallowClickRef.current = false
    }

    /* The browser's own gestures, headed off for the duration: a drag across
       the grid otherwise selects the captions as text and can start a native
       image drag. Not `preventDefault` on the pointerdown, which would suppress
       both in one line -- it also suppresses the focus and risks the click, and
       a shift-press that never crosses the threshold has to reach the card as
       an ordinary shift-click. These two cancel the gestures and touch nothing
       else. */
    const onSelectStart = (e: Event) => {
      if (originRef.current) e.preventDefault()
    }
    const onDragStart = (e: Event) => {
      if (originRef.current) e.preventDefault()
    }

    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('selectstart', onSelectStart)
    window.addEventListener('dragstart', onDragStart)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('selectstart', onSelectStart)
      swallowClickRef.current = false
      window.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('click', onClick, true)
    }
  }, [enabled, end])

  // Leaving select mode mid-sweep (Escape, a batch action landing) leaves the
  // rectangle painted over nothing otherwise.
  useEffect(() => {
    if (!enabled) end()
  }, [enabled, end])

  return { onPointerDown, rect, sweeping: rect !== null }
}
