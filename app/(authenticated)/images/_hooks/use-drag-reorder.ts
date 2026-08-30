'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { moveTo } from '#/lib/reorder'

/** The same five pixels the sweep and the drag-to-group use. A press that
 *  never crosses it reaches the card as an ordinary click, which is what keeps
 *  a selection toggle from ever being an accidental rearrangement. */
const DRAG_THRESHOLD = 5

/** A card the drag can be inserted around, measured once at drag start. Page
 *  coordinates, so a mid-drag scroll does not move the slots. */
interface Slot {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

export interface DragReorderState {
  /** The card that was lifted. */
  id: string
  x: number
  y: number
  /** Where it would land, as an index into the *current* order. `null` when
   *  the pointer is somewhere the drop would change nothing. */
  index: number | null
  /** The id the indicator is drawn before, or null for the very end. Rendering
   *  wants an anchor rather than a number, since the grid draws by card. */
  beforeId: string | null
}

interface UseDragReorderOptions {
  /** Only in a group. There is one order at top level and it is the
   *  library's. */
  enabled: boolean
  /** Every id in the grid, in the order it is rendered. */
  ids: Array<string>
  /** The new order, whole rather than "this one moved to here". Every member
   *  needs a number for the arrangement to be total -- an unnumbered row sorts
   *  after every numbered one, which is the rule that makes a new image land at
   *  the end, and would otherwise strand an untouched card there. */
  onReorder: (orderedIds: Array<string>) => void
}

/**
 * Drag a card to a new place in the group (#505).
 *
 * The sibling of `use-drag-to-group`, and the two never run at once: this one
 * is enabled only inside a group, where there are no group cards to drop onto,
 * and that one only at top level, where there is nothing to rearrange. Same
 * threshold, same click-swallowing, same Escape.
 *
 * **The insertion point is a gap, not a card.** Hit-testing which card you are
 * over and swapping with it makes a long move a sequence of swaps; picking the
 * nearest gap means dropping between two pictures does what it looks like. The
 * gap is chosen by which half of a card the pointer is in, which in a grid
 * means the left half puts it before that card and the right half after.
 *
 * **One card at a time**, even with a selection up. Moving several into one
 * place is a real design -- do they stay contiguous, in what order, what
 * happens to the gaps they leave -- and none of those questions have to be
 * answered for the gesture the issue asked for.
 *
 * Mouse, trackpad and pen only, as its two siblings are.
 */
export function useDragReorder({
  enabled,
  ids,
  onReorder,
}: UseDragReorderOptions) {
  const [drag, setDrag] = useState<DragReorderState | null>(null)

  const originRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef<string | null>(null)
  const slotsRef = useRef<Array<Slot>>([])
  const indexRef = useRef<number | null>(null)
  const committedRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const swallowClickRef = useRef(false)

  const idsRef = useRef(ids)
  const onReorderRef = useRef(onReorder)
  useEffect(() => {
    idsRef.current = ids
    onReorderRef.current = onReorder
  })

  const end = useCallback(() => {
    originRef.current = null
    draggedRef.current = null
    slotsRef.current = []
    indexRef.current = null
    committedRef.current = false
    pointerIdRef.current = null
    setDrag(null)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (e.button !== 0 || e.pointerType === 'touch') return
      // Shift-drag is the sweep (#440), here as at top level.
      if (e.shiftKey) return

      const target = e.target as HTMLElement
      if (target.closest('button, a, input, textarea, [role="menuitem"]'))
        return

      const card = target.closest('[data-drag-image-id]')
      if (!card || !e.currentTarget.contains(card)) return
      const id = card.getAttribute('data-drag-image-id')
      if (!id) return

      const slots: Array<Slot> = []
      for (const el of e.currentTarget.querySelectorAll(
        '[data-drag-image-id]',
      )) {
        const slotId = el.getAttribute('data-drag-image-id')
        if (!slotId) continue
        const r = el.getBoundingClientRect()
        slots.push({
          id: slotId,
          left: r.left + window.scrollX,
          top: r.top + window.scrollY,
          right: r.right + window.scrollX,
          bottom: r.bottom + window.scrollY,
        })
      }
      if (slots.length < 2) return

      draggedRef.current = id
      slotsRef.current = slots
      originRef.current = {
        x: e.clientX + window.scrollX,
        y: e.clientY + window.scrollY,
      }
      committedRef.current = false
      indexRef.current = null
      pointerIdRef.current = e.pointerId
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) return

    const onMove = (e: PointerEvent) => {
      const origin = originRef.current
      const dragged = draggedRef.current
      if (!origin || !dragged || e.pointerId !== pointerIdRef.current) return

      const x = e.clientX + window.scrollX
      const y = e.clientY + window.scrollY

      if (!committedRef.current) {
        if (Math.hypot(x - origin.x, y - origin.y) < DRAG_THRESHOLD) return
        committedRef.current = true
        window.getSelection()?.removeAllRanges()
      }

      // The card the pointer is inside, or -- past the last row, in a gutter --
      // the nearest one by centre distance. Falling back rather than reporting
      // nothing is what makes dropping below the grid mean "the end" instead
      // of meaning nothing.
      const slots = slotsRef.current
      let over = slots.findIndex(
        (s) => x >= s.left && x <= s.right && y >= s.top && y <= s.bottom,
      )
      if (over === -1) {
        let best = Infinity
        for (let i = 0; i < slots.length; i++) {
          const s = slots[i]
          const dx = x - (s.left + s.right) / 2
          const dy = y - (s.top + s.bottom) / 2
          const d = dx * dx + dy * dy
          if (d < best) {
            best = d
            over = i
          }
        }
      }

      const slot = slots[over]
      // Which half. In a grid the gaps run vertically between columns, so the
      // horizontal midpoint is the one that decides before-or-after.
      const after = x > (slot.left + slot.right) / 2
      const index = over + (after ? 1 : 0)

      // A drop that puts the card back where it already is is not a move. The
      // indicator goes away rather than sitting in the two places that mean
      // "nothing happens", which otherwise reads as the gesture being ready to
      // do something.
      const from = idsRef.current.indexOf(dragged)
      const target = index > from ? index - 1 : index
      let beforeId: string | null =
        index < slots.length ? slots[index].id : null
      if (from !== -1 && target === from) {
        indexRef.current = null
        beforeId = null
        setDrag({
          id: dragged,
          x: e.clientX,
          y: e.clientY,
          index: null,
          beforeId,
        })
        return
      }

      indexRef.current = index
      setDrag({ id: dragged, x: e.clientX, y: e.clientY, index, beforeId })
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return
      const dragged = draggedRef.current
      const index = indexRef.current
      if (committedRef.current && dragged && index !== null) {
        onReorderRef.current(moveTo(idsRef.current, dragged, index))
        swallowClickRef.current = true
      } else if (committedRef.current) {
        swallowClickRef.current = true
      }
      end()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && originRef.current) end()
    }

    const onClick = (e: MouseEvent) => {
      if (!swallowClickRef.current) return
      swallowClickRef.current = false
      if (e.detail === 0) return
      e.stopPropagation()
      e.preventDefault()
    }

    const onDown = () => {
      swallowClickRef.current = false
    }

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
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('selectstart', onSelectStart)
      window.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('click', onClick, true)
      swallowClickRef.current = false
    }
  }, [enabled, end])

  useEffect(() => {
    if (!enabled) end()
  }, [enabled, end])

  return { onPointerDown, drag, dragging: drag !== null }
}
