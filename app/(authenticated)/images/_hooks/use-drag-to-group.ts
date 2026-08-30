'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** How far the pointer travels before a press stops being a click and becomes
 *  a drag. The same five pixels `useSweepSelect` uses, and for the same
 *  reason: in select mode the whole card is one click target (#284), so
 *  without a threshold every selection toggle would be a potential accidental
 *  file. A press that never crosses it reaches the card as an ordinary click. */
const DRAG_THRESHOLD = 5

/** A group card the drag can land on, measured once at drag start. Page
 *  coordinates (client + scroll), so scrolling mid-drag does not move the
 *  targets out from under the pointer. */
interface DropTarget {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

/** What the grid needs to paint while a drag is running. Client coordinates --
 *  the preview is `position: fixed` above the grid, so the grid's `zoom` never
 *  scales it. */
export interface DragToGroupState {
  /** Every image coming with this drag, in grid order. */
  ids: Array<string>
  x: number
  y: number
  /** The group under the pointer right now, or null over anything else. */
  overGroupId: string | null
}

interface UseDragToGroupOptions {
  /** Off wherever there is nothing to drop onto -- inside a group the grid
   *  holds no group cards, so the gesture is top level only and needs no case
   *  of its own. */
  enabled: boolean
  /** Something is picked. Dragging a card that is part of the selection brings
   *  the whole selection; dragging one that is not moves it alone and leaves
   *  the selection untouched. Dragging a thing you are pointing at should move
   *  that thing -- anything else makes the gesture depend on state you are not
   *  looking at. */
  selectionActive: boolean
  isSelected: (id: string) => boolean
  selectedIds: Array<string>
  /** The drop. Same call the picker dialog makes -- this is a gesture over an
   *  existing action, not a second way to write. */
  onDrop: (groupId: string, ids: Array<string>) => void
}

/**
 * Drag a thumbnail onto a group card to file it there (#438).
 *
 * The dialog stays: it is still how you file into a group scrolled out of
 * view, and how you create one on the way. This is the shortcut for the case
 * where the destination is already on screen.
 *
 * **Pointer events, not HTML5 drag-and-drop.** Native DnD hands you
 * `dragover`/`drop` and a drag image cheaply, but that image is one element --
 * wrong for "five pictures are coming with this" -- and the canvas already
 * works in pointer events, so this is the house pattern.
 *
 * **A group card is a drop target and never a draggable.** Groups do not nest,
 * so dragging one does nothing at all rather than appearing to lift.
 *
 * Mouse, trackpad and pen only, exactly as `useSweepSelect` is. On touch a
 * press that moves is a scroll, and arming a drag at five pixels would take
 * the wall's scrolling away; a hold-to-lift gesture is the answer there and it
 * is not this.
 *
 * Cancelling is Escape, or letting go anywhere that is not a group card.
 * Either files nothing.
 */
export function useDragToGroup({
  enabled,
  selectionActive,
  isSelected,
  selectedIds,
  onDrop,
}: UseDragToGroupOptions) {
  const [drag, setDrag] = useState<DragToGroupState | null>(null)

  const originRef = useRef<{ x: number; y: number } | null>(null)
  const idsRef = useRef<Array<string>>([])
  const targetsRef = useRef<Array<DropTarget>>([])
  const overRef = useRef<string | null>(null)
  const committedRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  /** Set on pointerup so the click the browser fires next is swallowed: a drag
   *  that started on a card must not also open its lightbox or toggle its
   *  selection. Cleared by the next press as well, so a drag that ends where
   *  no click follows never leaves it armed to eat an unrelated click later --
   *  the bug `useSweepSelect` hit. */
  const swallowClickRef = useRef(false)

  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop
  })

  const end = useCallback(() => {
    originRef.current = null
    idsRef.current = []
    targetsRef.current = []
    overRef.current = null
    committedRef.current = false
    pointerIdRef.current = null
    setDrag(null)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (e.button !== 0 || e.pointerType === 'touch') return
      // Shift-drag is the sweep (#440). One press, two gestures, told apart by
      // the modifier rather than by what they land on.
      if (e.shiftKey) return

      const target = e.target as HTMLElement
      // A card carries `...`, a corner icon, a caption that is its own copy
      // button and a select tick. A drag starting on any of them does nothing
      // -- those are controls, and lifting the card out from under a press
      // aimed at one is the mess.
      if (target.closest('button, a, input, textarea, [role="menuitem"]'))
        return

      const card = target.closest('[data-drag-image-id]')
      if (!card || !e.currentTarget.contains(card)) return
      const id = card.getAttribute('data-drag-image-id')
      if (!id) return

      // One measurement, here: the grid does not reflow during a drag, so
      // re-measuring per pointer move would cost a layout pass a frame and buy
      // nothing.
      const targets: Array<DropTarget> = []
      for (const el of e.currentTarget.querySelectorAll(
        '[data-drop-group-id]',
      )) {
        const groupId = el.getAttribute('data-drop-group-id')
        if (!groupId) continue
        const r = el.getBoundingClientRect()
        targets.push({
          id: groupId,
          left: r.left + window.scrollX,
          top: r.top + window.scrollY,
          right: r.right + window.scrollX,
          bottom: r.bottom + window.scrollY,
        })
      }
      // No groups on screen means nowhere to drop. Not arming at all is what
      // keeps the plain click untouched on a library with no groups in it.
      if (targets.length === 0) return

      idsRef.current =
        selectionActive && isSelected(id) ? [...selectedIds] : [id]
      targetsRef.current = targets
      originRef.current = {
        x: e.clientX + window.scrollX,
        y: e.clientY + window.scrollY,
      }
      committedRef.current = false
      overRef.current = null
      pointerIdRef.current = e.pointerId
    },
    [enabled, selectionActive, isSelected, selectedIds],
  )

  // On the window rather than the grid: a drag routinely leaves the grid on
  // its way to a card at the other end of it, and the pointer can come up
  // anywhere.
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

      let over: string | null = null
      for (const t of targetsRef.current) {
        if (x >= t.left && x <= t.right && y >= t.top && y <= t.bottom) {
          over = t.id
          break
        }
      }
      overRef.current = over

      setDrag({
        ids: idsRef.current,
        x: e.clientX,
        y: e.clientY,
        overGroupId: over,
      })
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return
      const groupId = overRef.current
      const ids = idsRef.current
      if (committedRef.current) {
        swallowClickRef.current = true
        // Letting go over anything that is not a group card files nothing.
        if (groupId && ids.length > 0) onDropRef.current(groupId, ids)
      }
      end()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !originRef.current) return
      // Everything goes back and nothing is filed. The pointer is still down,
      // so clearing the origin is what stops the eventual pointerup dropping.
      end()
    }

    const onClick = (e: MouseEvent) => {
      if (!swallowClickRef.current) return
      swallowClickRef.current = false
      // `detail` is 0 for a click synthesised from the keyboard. Only the
      // pointer's own click is the one to eat.
      if (e.detail === 0) return
      e.stopPropagation()
      e.preventDefault()
    }

    const onDown = () => {
      swallowClickRef.current = false
    }

    /* The browser's own gestures for the duration: a drag across a thumbnail
       otherwise starts a native image drag and selects the caption as text.
       Not `preventDefault` on the pointerdown, which suppresses both in one
       line but takes the focus and the click with them -- and a press that
       never crosses the threshold has to reach the card as an ordinary
       click. */
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

  // The grid losing the gesture out from under a live drag (a batch action
  // landing, the route leaving a group) would otherwise leave the preview
  // painted over nothing.
  useEffect(() => {
    if (!enabled) end()
  }, [enabled, end])

  return { onPointerDown, drag, dragging: drag !== null }
}
