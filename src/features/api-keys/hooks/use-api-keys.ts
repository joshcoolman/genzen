import { useCallback, useEffect, useState } from 'react'
import { listApiKeysFn } from '../server/list-api-keys.server'
import { createApiKeyFn } from '../server/create-api-key.server'
import { revokeApiKeyFn } from '../server/revoke-api-key.server'
import type { ApiKey } from '../types'
import { useAuth } from '@/lib/auth'

export function useApiKeys() {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [keys, setKeys] = useState<Array<ApiKey>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const { keys: next } = await listApiKeysFn({ data: { accessToken } })
      setKeys(next)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const createKey = useCallback(
    async (name: string) => {
      if (!accessToken) throw new Error('Not signed in')
      const { rawKey, key } = await createApiKeyFn({
        data: { accessToken, name },
      })
      setKeys((prev) => [key, ...prev])
      return rawKey
    },
    [accessToken],
  )

  const revokeKey = useCallback(
    async (id: string) => {
      if (!accessToken) return
      const previous = keys
      setKeys((prev) =>
        prev.map((k) =>
          k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k,
        ),
      )
      try {
        await revokeApiKeyFn({ data: { accessToken, id } })
      } catch (err) {
        setKeys(previous)
        throw err
      }
    },
    [accessToken, keys],
  )

  return { keys, loading, error, refresh: fetchKeys, createKey, revokeKey }
}
