import { useCallback, useEffect, useRef, useState } from 'react'
import { idbDelete, idbGet, idbSet } from '@/lib/idb-storage'

export function usePersistedBlob<T>(key: string, debounceMs = 1000) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    idbGet<T>('blobs', key)
      .then((value) => setData(value))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [key])

  const set = useCallback(
    (value: T) => {
      setData(value)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        idbSet('blobs', key, value).catch(() => {})
      }, debounceMs)
    },
    [key, debounceMs],
  )

  const clear = useCallback(() => {
    setData(null)
    if (timerRef.current) clearTimeout(timerRef.current)
    idbDelete('blobs', key).catch(() => {})
  }, [key])

  return { data, loading, set, clear }
}
