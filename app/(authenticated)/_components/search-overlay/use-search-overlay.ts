'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { filterLibrary } from './filter-library'
import type { OverlayFilter } from './filter-library'
import type { LibraryIndexRow } from '#/features/user-images/server/library-index.actions'
import { listLibraryIndex } from '#/features/user-images/server/library-index.actions'
import { copyImageRef } from '#/lib/image-clipboard'
import { setKeyboardCaptured } from '#/lib/keyboard-capture'
import { toast } from '#/components'

/**
 * The overlay's state (#213).
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
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fetch generation, so a slow open that resolves after a close (or after a
  // second open) cannot repaint the list underneath the current one.
  const fetchIdRef = useRef(0)

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedId(null)
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

  // A selection that the query or the filter has just hidden cannot be the
  // thing Cmd-C copies -- it is off screen.
  useEffect(() => {
    if (selectedId && !results.some((row) => row.id === selectedId)) {
      setSelectedId(null)
    }
  }, [results, selectedId])

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

  const copyImage = useCallback(async (row: LibraryIndexRow) => {
    try {
      await copyImageRef(row.id)
      toast('Image copied -- paste it on Images or Canvas', {
        variant: 'success',
      })
    } catch {
      toast('Could not reach the clipboard', { variant: 'error' })
    }
  }, [])

  /* -- Cmd-C copies the selected row's image -- */
  useEffect(() => {
    if (!isOpen || !selectedId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || !(e.metaKey || e.ctrlKey)) return
      // Never steal a copy from a real text selection -- the prompt in a row is
      // selectable text, and reading one then copying part of it by hand is a
      // reasonable thing to do.
      if (!window.getSelection()?.isCollapsed) return
      const row = results.find((r) => r.id === selectedId)
      if (!row) return
      e.preventDefault()
      void copyImage(row)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, selectedId, results, copyImage])

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
    selectedId,
    setSelectedId,
    copyPrompt,
    copyImage,
  }
}
