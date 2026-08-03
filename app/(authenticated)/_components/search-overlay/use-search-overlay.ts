'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { filterLibrary } from './filter-library'
import type { OverlayFilter } from './filter-library'
import type { LibraryIndexRow } from '#/features/user-images/server/library-index.action'
import { listLibraryIndex } from '#/features/user-images/server/library-index.action'
import { copyImageRefs } from '#/lib/image-clipboard'
import { setKeyboardCaptured } from '#/lib/keyboard-capture'
import { toast } from '#/components'

/** Images can only ever hold this many references, so a copy made from that
 *  route is capped at the source rather than left to overflow at the paste
 *  end (#250). Canvas has no such limit and isn't subject to this. */
const IMAGES_SELECTION_CAP = 3

/**
 * The overlay's state (#213, multi-select #250).
 *
 * Everything here is throwaway except the rows: opening fetches, closing keeps
 * the list in memory and drops the query, the selection and the scroll. That is
 * the ticket's "Escape restores" -- there is nothing to restore because nothing
 * outside this hook was touched.
 */
export function useSearchOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [rows, setRows] = useState<Array<LibraryIndexRow>>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<OverlayFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const pathname = usePathname()
  // Images can only take 3 references, so a copy started there is capped at
  // the source. Every other surface (Canvas) has no such ceiling.
  const selectionCap = pathname === '/images' ? IMAGES_SELECTION_CAP : null

  // Fetch generation, so a slow open that resolves after a close (or after a
  // second open) cannot repaint the list underneath the current one.
  const fetchIdRef = useRef(0)

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedIds(new Set())
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
    const id = ++fetchIdRef.current
    // Only the *first* open shows a loading state. Every open after it repaints
    // the rows it already has and swaps them when the read lands, because a
    // list that empties itself on the way to being identical is a flicker.
    setRows((prev) => {
      if (prev.length === 0) setLoading(true)
      return prev
    })
    void listLibraryIndex()
      .then((next) => {
        if (id !== fetchIdRef.current) return
        setRows(next)
      })
      .catch(() => {
        if (id !== fetchIdRef.current) return
        toast('Could not load your library', { variant: 'error' })
      })
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false)
      })
  }, [])

  // While it is open the routes underneath stop hearing keystrokes -- see
  // `keyboard-capture.ts` for why that cannot be each route's own check.
  useEffect(() => {
    setKeyboardCaptured(isOpen)
    return () => setKeyboardCaptured(false)
  }, [isOpen])

  /* -- Cmd-F, from anywhere -- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape is handled here rather than on the panel because a click on a
      // row moves focus off the input, and a keydown on an unfocused div never
      // arrives. Escape always working is the contract.
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopPropagation()
        close()
        return
      }
      if (e.key.toLowerCase() !== 'f' || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      if (isOpen) close()
      else open()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, open, close])

  const results = useMemo(
    () => filterLibrary(rows, query, filter),
    [rows, query, filter],
  )

  // A selection the query or the filter has just hidden cannot be part of
  // what Cmd-C copies -- it is off screen.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(results.map((row) => row.id))
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [results])

  const toggleSelected = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (prev.has(id)) {
          const next = new Set(prev)
          next.delete(id)
          return next
        }
        if (selectionCap !== null && prev.size >= selectionCap) {
          toast(`Pick up to ${selectionCap} reference images`)
          return prev
        }
        return new Set(prev).add(id)
      })
    },
    [selectionCap],
  )

  // Both copies report their own failure. `writeText` rejects for reasons the
  // page cannot see coming -- an unfocused document is the common one -- and a
  // copy that silently did not happen is the worst version of this feature:
  // you dismiss, you paste, and you get whatever was on the clipboard before.
  const copyPrompt = useCallback(async (row: LibraryIndexRow) => {
    if (!row.prompt) return
    try {
      await navigator.clipboard.writeText(row.prompt)
      toast('Prompt copied', { variant: 'success' })
    } catch {
      toast('Could not reach the clipboard', { variant: 'error' })
    }
  }, [])

  // Grid order, not selection order -- predictable regardless of click order.
  const selectedRows = useMemo(
    () => results.filter((row) => selectedIds.has(row.id)),
    [results, selectedIds],
  )

  const copySelected = useCallback(async () => {
    if (selectedRows.length === 0) return
    try {
      await copyImageRefs(selectedRows.map((row) => row.id))
      toast(
        selectedRows.length === 1
          ? 'Image copied -- paste it on Images or Canvas'
          : `${selectedRows.length} images copied -- paste them on Images or Canvas`,
        { variant: 'success' },
      )
    } catch {
      toast('Could not reach the clipboard', { variant: 'error' })
    }
  }, [selectedRows])

  /* -- Cmd-C copies every selected image -- */
  useEffect(() => {
    if (!isOpen || selectedRows.length === 0) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || !(e.metaKey || e.ctrlKey)) return
      // Never steal a copy from a real text selection -- the prompt in a row is
      // selectable text, and reading one then copying part of it by hand is a
      // reasonable thing to do.
      if (!window.getSelection()?.isCollapsed) return
      e.preventDefault()
      void copySelected()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, selectedRows, copySelected])

  return {
    isOpen,
    open,
    close,
    loading,
    query,
    setQuery,
    filter,
    setFilter,
    results,
    total: rows.length,
    selectedIds,
    toggleSelected,
    selectionCap,
    copyPrompt,
    copySelected,
    selectedCount: selectedRows.length,
  }
}
