'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'genzen:hidden-nav-items'
const MORE_NAV_KEY = 'genzen:show-more-nav'

type Listener = () => void
const listeners = new Set<Listener>()

// Cache the parsed result so getSnapshot returns a stable reference
let cachedRaw: string | null = null
let cachedResult: Array<string> = []
const EMPTY: Array<string> = []

// Cache for showMoreNav boolean
let cachedMoreRaw: string | null = null
let cachedMoreResult = true

function getSnapshot(): Array<string> {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      cachedResult = raw ? JSON.parse(raw) : []
    }
    return cachedResult
  } catch {
    return EMPTY
  }
}

function getMoreSnapshot(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(MORE_NAV_KEY)
    if (raw !== cachedMoreRaw) {
      cachedMoreRaw = raw
      cachedMoreResult = raw === null ? true : raw === 'true'
    }
    return cachedMoreResult
  } catch {
    return true
  }
}

function getServerSnapshot(): Array<string> {
  return EMPTY
}

function getMoreServerSnapshot(): boolean {
  return true
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setHiddenItems(items: Array<string>) {
  const json = JSON.stringify(items)
  cachedRaw = json
  cachedResult = items
  localStorage.setItem(STORAGE_KEY, json)
  listeners.forEach((l) => l())
}

function setShowMore(value: boolean) {
  const str = String(value)
  cachedMoreRaw = str
  cachedMoreResult = value
  localStorage.setItem(MORE_NAV_KEY, str)
  listeners.forEach((l) => l())
}

export function useNavVisibility() {
  const hiddenItems = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const showMoreNav = useSyncExternalStore(
    subscribe,
    getMoreSnapshot,
    getMoreServerSnapshot,
  )

  const toggleItem = useCallback((id: string) => {
    const current = getSnapshot()
    const next = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id]
    setHiddenItems(next)
  }, [])

  const isItemHidden = useCallback(
    (id: string) => hiddenItems.includes(id),
    [hiddenItems],
  )

  const toggleShowMore = useCallback(() => {
    setShowMore(!getMoreSnapshot())
  }, [])

  return { hiddenItems, toggleItem, isItemHidden, showMoreNav, toggleShowMore }
}
