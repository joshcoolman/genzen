'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCanvas,
  deleteCanvas,
  listCanvases,
  renameCanvas,
} from './_actions/canvases'
import type { CanvasSummary } from './_actions/canvases'

/** Which one-field flow is up, and what it is about to act on. */
export type CanvasFlow =
  | { kind: 'create' }
  | { kind: 'rename'; canvas: CanvasSummary }
  | { kind: 'confirm-delete'; canvas: CanvasSummary }
  | null

/**
 * The canvas index's state: the list, and the three verbs that change it.
 *
 * Creating opens the new board rather than returning to the list. Naming a
 * canvas is something you do because you are about to put things on it, so
 * landing back on the index would be a second click to do the obvious thing.
 *
 * Mutations refetch rather than patching the local array: every card carries a
 * count and a strip of covers the server derived, so a local edit would be
 * guessing at half of them.
 */
export function useView(initial: Array<CanvasSummary>) {
  const router = useRouter()
  const [canvases, setCanvases] = useState<Array<CanvasSummary>>(initial)
  const [flow, setFlow] = useState<CanvasFlow>(null)
  const [busy, setBusy] = useState(false)

  const closeFlow = useCallback(() => setFlow(null), [])

  const refetch = useCallback(async () => {
    try {
      setCanvases(await listCanvases())
    } catch {
      console.error('Failed to load canvases')
    }
  }, [])

  const open = useCallback(
    (canvas: CanvasSummary) => router.push(`/canvas/${canvas.id}`),
    [router],
  )

  const create = useCallback(
    async (name: string) => {
      setBusy(true)
      try {
        const id = await createCanvas(name)
        setFlow(null)
        router.push(`/canvas/${id}`)
      } finally {
        setBusy(false)
      }
    },
    [router],
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      setFlow(null)
      setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
      try {
        await renameCanvas(id, name)
      } finally {
        await refetch()
      }
    },
    [refetch],
  )

  const remove = useCallback(
    async (id: string) => {
      setFlow(null)
      setCanvases((prev) => prev.filter((c) => c.id !== id))
      try {
        await deleteCanvas(id)
      } finally {
        await refetch()
      }
    },
    [refetch],
  )

  return {
    canvases,
    flow,
    busy,
    setFlow,
    closeFlow,
    open,
    create,
    rename,
    remove,
  }
}
