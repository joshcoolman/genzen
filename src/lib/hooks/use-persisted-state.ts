import { useCallback, useEffect, useRef, useState } from 'react'

function load<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  debounceMs = 300,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => load<T>(key) ?? defaultValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch {}
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [key, state, debounceMs])

  const wrappedSetState: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (action) => setState(action),
    [],
  )

  return [state, wrappedSetState]
}
