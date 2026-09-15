'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  changeSessionName,
  loadSessions,
  newSession,
  removeSession,
} from './_actions/sessions.action'
import type { SessionSummary } from './_lib/types'

type Flow =
  | { kind: 'create' }
  | { kind: 'rename' | 'delete'; session: SessionSummary }
  | null
export function useView(initial: Array<SessionSummary>) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initial)
  const [flow, setFlow] = useState<Flow>(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState('')
  const createId = useRef<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadSessions()
      .then((items) => {
        if (!cancelled) setSessions(items)
      })
      .catch(() => {
        if (!cancelled)
          setError('Sessions could not be refreshed. Reload to try again.')
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
        cause instanceof Error
          ? cause.message
          : 'The session could not be saved.',
      )
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  return {
    sessions,
    flow,
    setFlow,
    busy,
    error,
    open: (session: SessionSummary) => router.push(`/director/${session.id}`),
    create: (name: string) =>
      run(async () => {
        createId.current ??= crypto.randomUUID()
        const created = await newSession(name, createId.current)
        createId.current = null
        setFlow(null)
        router.push(`/director/${created.id}`)
      }),
    rename: (id: string, name: string) =>
      run(async () => {
        await changeSessionName(id, name)
        setSessions(await loadSessions())
        setFlow(null)
      }),
    remove: (id: string) =>
      run(async () => {
        await removeSession(id)
        setSessions(await loadSessions())
        setFlow(null)
      }),
  }
}
