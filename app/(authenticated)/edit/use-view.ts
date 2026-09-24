'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  changeEditName,
  loadEdits,
  newEdit,
  removeEdit,
} from './_actions/edits.action'
import type { EditSummary } from './_lib/types'

type Flow =
  | { kind: 'create' }
  | { kind: 'rename' | 'delete'; edit: EditSummary }
  | null

/** Director's list hook, for edits. */
export function useView(initial: Array<EditSummary>) {
  const router = useRouter()
  const [edits, setEdits] = useState(initial)
  const [flow, setFlow] = useState<Flow>(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState('')
  const createId = useRef<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadEdits()
      .then((items) => {
        if (!cancelled) setEdits(items)
      })
      .catch(() => {
        if (!cancelled)
          setError('Edits could not be refreshed. Reload to try again.')
      })
    return () => {
      cancelled = true
    }
  }, [])
  async function run(action: () => Promise<void>) {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The edit could not be saved.',
      )
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  return {
    edits,
    flow,
    setFlow,
    busy,
    error,
    open: (edit: EditSummary) => router.push(`/edit/${edit.id}`),
    create: (name: string) =>
      run(async () => {
        createId.current ??= crypto.randomUUID()
        const created = await newEdit(name, createId.current)
        createId.current = null
        setFlow(null)
        router.push(`/edit/${created.id}`)
      }),
    rename: (id: string, name: string) =>
      run(async () => {
        await changeEditName(id, name)
        setEdits(await loadEdits())
        setFlow(null)
      }),
    remove: (id: string) =>
      run(async () => {
        await removeEdit(id)
        setEdits(await loadEdits())
        setFlow(null)
      }),
  }
}
