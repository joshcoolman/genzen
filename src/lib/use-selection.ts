'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSelectionOptions {
  /** Ordered list of all selectable item IDs (used for shift-range) */
  items: Array<string>
}

interface UseSelectionReturn {
  selectedIds: Set<string>
  toggle: (id: string, shiftKey?: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
  count: number
}

export function useSelection({
  items,
}: UseSelectionOptions): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastToggledId = useRef<string | null>(null)

  // Prune stale IDs when items list changes
  useEffect(() => {
    setSelectedIds((prev) => {
      const itemSet = new Set(items)
      const pruned = new Set<string>()
      for (const id of prev) {
        if (itemSet.has(id)) pruned.add(id)
      }
      if (pruned.size !== prev.size) {
        if (!lastToggledId.current || !itemSet.has(lastToggledId.current)) {
          lastToggledId.current = null
        }
        return pruned
      }
      return prev
    })
  }, [items])

  const toggle = useCallback(
    (id: string, shiftKey?: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)

        if (shiftKey && lastToggledId.current && lastToggledId.current !== id) {
          const startIdx = items.indexOf(lastToggledId.current)
          const endIdx = items.indexOf(id)
          if (startIdx !== -1 && endIdx !== -1) {
            const lo = Math.min(startIdx, endIdx)
            const hi = Math.max(startIdx, endIdx)
            for (let i = lo; i <= hi; i++) {
              next.add(items[i])
            }
            lastToggledId.current = id
            return next
          }
        }

        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        lastToggledId.current = id
        return next
      })
    },
    [items],
  )

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items))
  }, [items])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    lastToggledId.current = null
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  return {
    selectedIds,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    count: selectedIds.size,
  }
}
