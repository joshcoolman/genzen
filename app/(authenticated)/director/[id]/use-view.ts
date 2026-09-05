'use client'

import { useEffect, useRef, useState } from 'react'
import { dismissClip, pollClip, startClip } from '../_actions/generate.action'
import {
  loadSession,
  updateOpening,
  updateSettings,
  writeDraft,
} from '../_actions/sessions.action'
import { emptyCut } from '../clips'
import { hydrateCut } from '../_lib/hydrate'
import { uploadMedia } from '../_lib/upload'
import type { Session } from '../_lib/types'
import type { Cut, Settings } from '../clips'
import type { SavedTake } from '../recording'

export function useView(initial: Session) {
  const [session, setSession] = useState(initial)
  const current = useRef(initial)
  const [cut, setCut] = useState<Cut>(emptyCut)
  const [archives, setArchives] = useState<Array<SavedTake>>([])
  const [prompt, setPrompt] = useState(initial.draft)
  const promptRef = useRef(initial.draft)
  const savedDraft = useRef(initial.draft)
  const draftConflict = useRef(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Loading session...')
  const alive = useRef(false)
  const isAlive = () => alive.current
  const pendingRequest = () => current.current.cut.pending
  const working = useRef(false)
  const cache = useRef(new Map<string, Blob>())
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftQueue = useRef(Promise.resolve())
  const draftKey = `genzen-director-draft-${initial.id}`
  const report = (cause: unknown) => {
    if (isAlive())
      setError(
        cause instanceof Error
          ? cause.message
          : 'The request failed. Your saved session is unchanged.',
      )
  }
  async function apply(next: Session) {
    const hydrated = await hydrateCut(next.cut, cache.current)
    if (!isAlive()) return
    current.current = next
    setSession(next)
    setCut(hydrated.cut)
    setArchives(hydrated.archives)
  }
  function flushDraft() {
    draftQueue.current = draftQueue.current
      .then(async () => {
        if (draftConflict.current) return
        const value = promptRef.current
        if (value === savedDraft.current) return
        if (isAlive()) setSavingDraft(true)
        await writeDraft(initial.id, value, savedDraft.current)
        savedDraft.current = value
        if (promptRef.current === value) localStorage.removeItem(draftKey)
      })
      .catch(report)
      .finally(() => {
        if (isAlive()) setSavingDraft(false)
      })
    return draftQueue.current
  }
  function changePrompt(value: string) {
    draftConflict.current = false
    setSavingDraft(true)
    setPrompt(value)
    promptRef.current = value
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ base: savedDraft.current, draft: value }),
      )
    } catch {
      report(new Error('The draft backup could not be saved.'))
    }
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => void flushDraft(), 600)
  }
  async function recover() {
    if (!isAlive() || working.current) return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      const next = await pollClip(initial.id)
      await apply(next)
      if (!isAlive()) return
      if (next.cut.pending) {
        if (!next.cut.pending.token)
          setStatus(
            'Submission uncertain. Check the existing request before dismissing it.',
          )
        else if (Date.now() - next.cut.pending.startedAt > 10 * 60 * 1000)
          setStatus(
            'Generation is taking longer than expected. Check the existing request again later.',
          )
        else {
          setStatus('Generating next section...')
          pollTimer.current = setTimeout(() => void recover(), 2000)
        }
      } else setStatus('Saved')
    } catch (cause) {
      report(cause)
      if (isAlive())
        setStatus('Request retained. Check again without generating again.')
    } finally {
      working.current = false
      if (isAlive()) setBusy(false)
    }
  }
  async function submit(redo: boolean) {
    if (
      !ready ||
      working.current ||
      current.current.cut.pending ||
      !promptRef.current.trim()
    )
      return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      await flushDraft()
      setStatus('Submitting one clip...')
      const next = await startClip(
        initial.id,
        current.current.revision,
        crypto.randomUUID(),
        promptRef.current.trim(),
        redo,
      )
      await apply(next)
      if (isAlive()) changePrompt('')
    } catch (cause) {
      report(cause)
      const next = await loadSession(initial.id).catch(() => null)
      if (next) await apply(next).catch(report)
    } finally {
      working.current = false
      if (isAlive()) {
        setBusy(false)
        if (pendingRequest()) void recover()
      }
    }
  }
  async function mutate(action: () => Promise<Session>, message = 'Saved') {
    if (!ready || working.current) return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      await apply(await action())
      if (isAlive()) setStatus(message)
    } catch (cause) {
      report(cause)
    } finally {
      working.current = false
      if (isAlive()) setBusy(false)
    }
  }
  useEffect(() => {
    alive.current = true
    let cancelled = false
    async function restore() {
      try {
        await apply(initial)
        if (cancelled) return
        const backup = localStorage.getItem(draftKey)
        if (backup) {
          const value = JSON.parse(backup)
          if (typeof value.draft === 'string') {
            setPrompt(value.draft)
            promptRef.current = value.draft
            if (value.base === initial.draft) void flushDraft()
            else {
              draftConflict.current = true
              report(
                new Error(
                  'A local draft was recovered over newer saved text. Review it before editing.',
                ),
              )
            }
          }
        }
        setReady(true)
        setStatus('Saved')
        if (initial.cut.pending) void recover()
      } catch (cause) {
        report(cause)
      }
    }
    void restore()
    const warn = (event: BeforeUnloadEvent) => {
      if (promptRef.current !== savedDraft.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      cancelled = true
      alive.current = false
      if (pollTimer.current) clearTimeout(pollTimer.current)
      if (draftTimer.current) clearTimeout(draftTimer.current)
      void flushDraft()
      window.removeEventListener('beforeunload', warn)
    }
  }, [initial.id])
  return {
    session,
    cut,
    archives,
    prompt,
    setPrompt: changePrompt,
    ready,
    busy,
    error,
    status: savingDraft ? 'Saving draft...' : status,
    submit,
    changeSettings: (settings: Settings) =>
      mutate(() =>
        updateSettings(initial.id, current.current.revision, settings),
      ),
    changeImage: (file: File | null) =>
      mutate(async () => {
        if (file && file.size > 15 * 1024 * 1024)
          throw new Error('Choose an image under 15 MB.')
        const media = file ? await uploadMedia(initial.id, file) : null
        return updateOpening(
          initial.id,
          current.current.revision,
          media?.mediaId ?? null,
        )
      }),
    forgetPending: () =>
      mutate(
        () => dismissClip(initial.id, current.current.revision),
        'Request dismissed',
      ),
    checkRequest: () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
      void recover()
    },
  }
}
