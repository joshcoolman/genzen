'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  checkEndpoint,
  listEndpoints,
  removeEndpoint,
  saveEndpoint,
} from './_actions/endpoints.action'
import type { SavedEndpoint } from './_actions/endpoints.action'
import type { ParsedEndpoint } from './parse-schema'

/**
 * What the content area is showing.
 *
 * `savedId` is null for a report that has just been checked and not kept --
 * the state Save exists to leave. Selecting from the rail sets it, and that is
 * the whole difference between the two: the report itself is the same object
 * either way.
 */
interface Viewing {
  sourceUrl: string
  report: ParsedEndpoint
  savedId: string | null
}

export function useView() {
  const [url, setUrl] = useState('')
  const [saved, setSaved] = useState<Array<SavedEndpoint>>([])
  const [viewing, setViewing] = useState<Viewing | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listEndpoints()
      .then((rows) => {
        if (live) setSaved(rows)
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
      const result = await checkEndpoint(url)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Already in the rail? The fresh report opens as that saved one rather
      // than as an unsaved report -- otherwise re-checking something you kept
      // offers to save a second copy of it.
      const existing = saved.find(
        (e) => e.endpointId === result.report.endpointId,
      )
      setViewing({
        sourceUrl: result.sourceUrl,
        report: result.report,
        savedId: existing?.id ?? null,
      })
      setUrl('')
    } catch {
      setError('Something went wrong reading that endpoint.')
    } finally {
      setChecking(false)
    }
  }, [url, checking, saved])

  const save = useCallback(async () => {
    if (!viewing || viewing.savedId || saving) return
    setSaving(true)
    try {
      const row = await saveEndpoint(viewing.sourceUrl, viewing.report)
      setSaved((prev) => [row, ...prev.filter((e) => e.id !== row.id)])
      setViewing((prev) => (prev ? { ...prev, savedId: row.id } : prev))
    } catch {
      setError('Could not save that endpoint.')
    } finally {
      setSaving(false)
    }
  }, [viewing, saving])

  const select = useCallback((endpoint: SavedEndpoint) => {
    setError(null)
    setViewing({
      sourceUrl: endpoint.sourceUrl,
      report: endpoint.report,
      savedId: endpoint.id,
    })
  }, [])

  const remove = useCallback(async (id: string) => {
    setSaved((prev) => prev.filter((e) => e.id !== id))
    // Removing the endpoint you are looking at clears the content area rather
    // than leaving a report for something no longer in the rail.
    setViewing((prev) => (prev?.savedId === id ? null : prev))
    await removeEndpoint(id)
  }, [])

  return {
    url,
    setUrl,
    saved,
    viewing,
    loading,
    checking,
    saving,
    error,
    check,
    save,
    select,
    remove,
  }
}
