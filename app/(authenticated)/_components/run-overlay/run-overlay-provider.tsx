'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { RunOverlay } from './run-overlay'
import type { RunEvent, RunSnapshot, RunSource } from './types'

const MAX_SNIPPETS = 4

interface RunOverlayApi {
  /** Watch a job. Replaces whatever the overlay was showing. */
  start: (title: string, source: RunSource) => void
  active: boolean
}

const RunOverlayContext = createContext<RunOverlayApi | null>(null)

export function useRunOverlay() {
  const api = useContext(RunOverlayContext)
  if (!api) throw new Error('useRunOverlay outside RunOverlayProvider')
  return api
}

function reduce(snap: RunSnapshot, event: RunEvent, seq: number): RunSnapshot {
  const next = { ...snap, beat: snap.beat + 1 }
  switch (event.kind) {
    case 'activity':
      return { ...next, activity: event.text }
    case 'snippet':
      return {
        ...next,
        snippets: [
          { id: seq, label: event.label, text: event.text, tone: event.tone },
          ...snap.snippets,
        ].slice(0, MAX_SNIPPETS),
      }
    case 'item':
      return { ...next, done: event.done, total: event.total ?? snap.total }
    case 'end':
      return { ...next, end: event }
  }
}

/**
 * Mounted in the app shell, above every route, so a run keeps showing while you
 * read an article or go elsewhere (#725). Presentation state only -- expanded
 * or minimized lives here, and whatever executes the job lives in the source.
 * Surviving a refresh is #737's job: this state is gone with the page.
 */
export function RunOverlayProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [snap, setSnap] = useState<RunSnapshot | null>(null)
  const [minimized, setMinimized] = useState(false)
  const stop = useRef<(() => void) | null>(null)
  const seq = useRef(0)

  const dismiss = useCallback(() => {
    stop.current?.()
    stop.current = null
    setSnap(null)
  }, [])

  const start = useCallback((title: string, source: RunSource) => {
    stop.current?.()
    setMinimized(false)
    setSnap({
      id: crypto.randomUUID(),
      title,
      activity: 'Starting',
      snippets: [],
      done: 0,
      beat: 0,
    })
    stop.current = source((event) => {
      seq.current += 1
      const n = seq.current
      setSnap((s) => (s ? reduce(s, event, n) : s))
    })
  }, [])

  return (
    <RunOverlayContext.Provider value={{ start, active: !!snap && !snap.end }}>
      {children}
      {snap && (
        <RunOverlay
          snap={snap}
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onExpand={() => setMinimized(false)}
          onDismiss={dismiss}
        />
      )}
    </RunOverlayContext.Provider>
  )
}
