'use client'

import { useEffect } from 'react'
import hotkeys from 'hotkeys-js'
import { getBounds } from '../_lib/geometry'
import type { Bounds } from '../_lib/geometry'
import type { CanvasImage, Transform } from '../_lib/types'

interface UseCanvasHotkeysArgs {
  iRef: React.RefObject<Array<CanvasImage>>
  sRef: React.RefObject<Set<string>>
  tRef: React.RefObject<Transform>
  /** Suppresses every binding while a dialog owns the keyboard. */
  dialogOpenRef: React.RefObject<boolean>
  zoomCenter: (scale: number) => void
  fitBounds: (bounds: Bounds) => void
  focusBounds: (bounds: Bounds) => void
  select: (next: Set<string>) => void
  clearSelection: () => void
  groupSelected: (columns: number) => void
  ungroupSelected: () => void
  undo: () => void
  redo: () => void
  onDeleteRequest: (ids: Array<string>) => void
}

const ZOOM_STEP = 1.25
const GROUP_COLUMNS = 4

const BINDINGS = [
  'command+=,command+plus',
  'command+-',
  'command+0',
  'command+1',
  'command+2',
  'command+shift+0',
  'backspace,delete',
  'command+a',
  'escape',
  'command+z',
  'command+shift+z',
  'command+g',
  'command+shift+g',
] as const

export function useCanvasHotkeys({
  iRef,
  sRef,
  tRef,
  dialogOpenRef,
  zoomCenter,
  fitBounds,
  focusBounds,
  select,
  clearSelection,
  groupSelected,
  ungroupSelected,
  undo,
  redo,
  onDeleteRequest,
}: UseCanvasHotkeysArgs) {
  useEffect(() => {
    hotkeys.filter = () => !dialogOpenRef.current

    /** The selection if there is one, else the whole canvas. */
    const targets = () => {
      const sel = sRef.current
      return sel.size > 0
        ? iRef.current.filter((i) => sel.has(i.id))
        : iRef.current
    }

    const bind = (keys: string, fn: () => void) =>
      hotkeys(keys, (e) => {
        e.preventDefault()
        fn()
      })

    bind('command+=,command+plus', () =>
      zoomCenter(tRef.current.scale * ZOOM_STEP),
    )
    bind('command+-', () => zoomCenter(tRef.current.scale / ZOOM_STEP))
    bind('command+1', () => zoomCenter(1.0))

    // cmd+0 focuses at 75%; cmd+2 fits edge-to-edge with padding.
    bind('command+0', () => {
      const t = targets()
      if (t.length > 0) focusBounds(getBounds(t))
    })
    bind('command+2', () => {
      const t = targets()
      if (t.length > 0) fitBounds(getBounds(t))
    })
    bind('command+shift+0', () => {
      if (iRef.current.length > 0) fitBounds(getBounds(iRef.current))
    })

    // Surfaces an explicit choice instead of silently removing -- the toast was
    // too easy to miss.
    bind('backspace,delete', () => {
      if (sRef.current.size > 0) onDeleteRequest([...sRef.current])
    })

    bind('command+a', () => select(new Set(iRef.current.map((i) => i.id))))
    hotkeys('escape', () => clearSelection())

    bind('command+z', undo)
    bind('command+shift+z', redo)
    bind('command+g', () => {
      if (sRef.current.size >= 2) groupSelected(GROUP_COLUMNS)
    })
    bind('command+shift+g', ungroupSelected)

    return () => {
      for (const keys of BINDINGS) hotkeys.unbind(keys)
    }
  }, [
    iRef,
    sRef,
    tRef,
    dialogOpenRef,
    zoomCenter,
    fitBounds,
    focusBounds,
    select,
    clearSelection,
    groupSelected,
    ungroupSelected,
    undo,
    redo,
    onDeleteRequest,
  ])
}
