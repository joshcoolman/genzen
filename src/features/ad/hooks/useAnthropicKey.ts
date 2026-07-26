'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'ad-anthropic-key'

type Listener = () => void
const listeners = new Set<Listener>()

function getSnapshot(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

function getServerSnapshot(): string {
  return ''
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setKey(value: string) {
  if (value) {
    localStorage.setItem(STORAGE_KEY, value)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  listeners.forEach((l) => l())
}

export function useAnthropicKey() {
  const apiKey = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setApiKey = useCallback((value: string) => {
    setKey(value)
  }, [])

  const clearApiKey = useCallback(() => {
    setKey('')
  }, [])

  return { apiKey, setApiKey, clearApiKey }
}
