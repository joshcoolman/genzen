'use client'

import { useEffect, useState } from 'react'
import type { ConnectionState } from './_components/connection-status/connection-status'
import { useAuth } from '#/lib/auth'
import { checkConnections } from '#/lib/server/check-connections.action'

export function useView() {
  const { user } = useAuth()
  const [fal, setFal] = useState<{ status: ConnectionState; error?: string }>({
    status: 'checking',
  })

  // Only FAL is probed now. The old page also pinged `supabase.auth.getUser()`
  // to prove the session was live -- there is no such round trip any more, the
  // session is a cookie this request already carried.
  useEffect(() => {
    checkConnections()
      .then((result) => setFal(result.fal))
      .catch((err: unknown) =>
        setFal({
          status: 'error',
          error: err instanceof Error ? err.message : 'Server error',
        }),
      )
  }, [])

  return { user, fal }
}
