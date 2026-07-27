'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/**
 * State that starts from a persisted value without breaking hydration.
 *
 * The obvious spelling -- `useState(() => localStorage.getItem(key) ?? fallback)`
 * -- worked under Vite, where these trees never rendered on the server. Under
 * SSR the server renders `fallback` and the client's first render reads storage,
 * so any user who had changed the setting got a hydration mismatch and React
 * threw the subtree away.
 *
 * So: render `fallback` on both sides, then adopt the stored value in an effect.
 * The returned `hydrated` flag is not decoration -- a persist-on-change effect
 * must wait for it, or it writes `fallback` over the stored value on mount and
 * the setting silently resets on every page load.
 */
export function usePersistedState<T>(
  read: () => T,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(fallback)
  const [hydrated, setHydrated] = useState(false)
  const readRef = useRef(read)
  readRef.current = read

  useEffect(() => {
    setValue(readRef.current())
    setHydrated(true)
  }, [])

  return [value, setValue, hydrated]
}
