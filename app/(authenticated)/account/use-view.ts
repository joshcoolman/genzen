'use client'

import { useEffect, useState } from 'react'
import type { ConnectionCheck } from '#/lib/server/check-connections.action'
import { useAuth } from '#/lib/auth'
import { checkConnections } from '#/lib/server/check-connections.action'

export function useView() {
  const { user } = useAuth()
  const [checks, setChecks] = useState<Array<ConnectionCheck>>([])
  const [isCheckingConnections, setIsChecking] = useState(true)

  // Probed from the client rather than in `page.tsx` on purpose: the FAL check
  // is a network round trip, and server-loading it would hold the whole page
  // back on the slowest thing on it. The stats are server-loaded; this fills in.
  useEffect(() => {
    let cancelled = false
    checkConnections()
      .then((result) => {
        if (!cancelled) setChecks(result.checks)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setChecks([
          {
            label: 'Services',
            status: 'error',
            error: err instanceof Error ? err.message : 'Server error',
            remedy: 'The check itself failed. Is `pnpm dev` still running?',
          },
        ])
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { user, checks, isCheckingConnections }
}
