import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sidebar-collapsed'

type Listener = () => void
const listeners = new Set<Listener>()

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function getServerSnapshot(): boolean {
  return false
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setCollapsed(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value))
  listeners.forEach((l) => l())
}

export function useSidebarCollapsed() {
  const isCollapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!getSnapshot())
  }, [])

  const setIsCollapsed = useCallback((value: boolean) => {
    setCollapsed(value)
  }, [])

  return { isCollapsed, toggleCollapsed, setIsCollapsed }
}
