import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadFinalCuts,
  manageFinalCut,
  startFinalCut,
} from '../../_actions/final-cuts.action'
import type { FinalCutSummary } from '../../_lib/final-cut'

export function useFinalCuts(sessionId: string) {
  const [items, setItems] = useState<Array<FinalCutSummary>>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const working = useRef(false)
  const refresh = useCallback(async () => {
    const result = await loadFinalCuts(sessionId)
    setItems(result)
    setLoaded(true)
    return result
  }, [sessionId])
  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const result = await loadFinalCuts(sessionId)
        for (const item of result) {
          const key = `director-final-start:${sessionId}:${item.export_id}`
          if (sessionStorage.getItem(key) === item.id)
            sessionStorage.removeItem(key)
        }
        if (mounted) {
          setItems(result)
          setLoaded(true)
        }
      } catch (cause) {
        if (mounted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load Final Cuts.',
          )
      } finally {
        if (mounted)
          timer = setTimeout(() => {
            void poll()
          }, 5000)
      }
    }
    void poll()
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [sessionId])
  async function run(action: () => Promise<unknown>) {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Final Cut could not be updated.',
      )
    } finally {
      setBusy(false)
      working.current = false
    }
  }
  function start(exportId: string) {
    void run(async () => {
      const key = `director-final-start:${sessionId}:${exportId}`
      // Keep the same ID after a lost response, including across a page reload.
      const id = sessionStorage.getItem(key) ?? crypto.randomUUID()
      sessionStorage.setItem(key, id)
      const result = await startFinalCut(sessionId, exportId, id)
      if (!result.item) throw new Error(result.error)
      const item = result.item
      setItems((previous) => [
        ...previous.filter((entry) => entry.id !== item.id),
        item,
      ])
      sessionStorage.removeItem(key)
    })
  }
  return {
    items,
    loaded,
    busy,
    error,
    start,
    manage: (id: string, command: 'resume' | 'stop' | 'delete') =>
      run(async () => {
        const result = await manageFinalCut(id, command)
        if (result.error) throw new Error(result.error)
      }),
  }
}
