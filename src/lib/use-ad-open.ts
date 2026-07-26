'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ad-open'

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

function setOpen(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value))
  listeners.forEach((l) => l())
}

export function useADOpen() {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggleOpen = useCallback(() => {
    setOpen(!getSnapshot())
  }, [])

  const setIsOpen = useCallback((value: boolean) => {
    setOpen(value)
  }, [])

  return { isOpen, toggleOpen, setIsOpen }
}
