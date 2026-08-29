'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addEndpoint,
  listEndpoints,
  removeEndpoint,
} from './_actions/endpoints.action'
import type { SavedEndpoint } from './_actions/endpoints.action'

export function useView() {
  const [url, setUrl] = useState('')
  const [endpoints, setEndpoints] = useState<Array<SavedEndpoint>>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listEndpoints()
      .then((rows) => {
        if (live) setEndpoints(rows)
      })
      .catch(() => {
        if (live) setError('Could not load saved endpoints.')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const check = useCallback(async () => {
    if (!url.trim() || checking) return
    setChecking(true)
    setError(null)
    try {
      const result = await addEndpoint(url)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Re-adding an endpoint replaces its row rather than making a second one,
      // so the list has to replace in place -- otherwise a re-check shows the
      // same endpoint twice until a reload.
      setEndpoints((prev) => [
        result.endpoint,
        ...prev.filter((e) => e.id !== result.endpoint.id),
      ])
      setUrl('')
    } catch {
      setError('Something went wrong reading that endpoint.')
    } finally {
      setChecking(false)
    }
  }, [url, checking])

  const remove = useCallback(async (id: string) => {
    setEndpoints((prev) => prev.filter((e) => e.id !== id))
    await removeEndpoint(id)
  }, [])

  return { url, setUrl, endpoints, loading, checking, error, check, remove }
}
