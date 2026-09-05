'use client'

import { useEffect, useRef, useState } from 'react'
import { checkClip, submitClip } from './_actions/clips.action'
import { PROMPT_LIMIT, completeClip, emptyCut, generationBase } from './clips'
import { draftKey, readCut, saveCut } from './clip-store'
import { clipFrame } from './clip-frame'
import { clearLocalSession, listTakes, readInitialImage } from './recording'
import { emptySession, readSession, writeSession } from './session-state'
import type { Clip, Cut, PendingClip, Settings } from './clips'
import type { SavedTake } from './recording'

export function useView(owner: string) {
  const [cut, setCut] = useState<Cut>(emptyCut)
  const current = useRef(cut)
  const [prompt, setPrompt] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Restoring local cut…')
  const [archives, setArchives] = useState<Array<SavedTake>>([])
  const alive = useRef(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const run = useRef(0)
  const isCurrent = (attempt: number) =>
    alive.current && attempt === run.current
  const report = (cause: unknown) => {
    if (alive.current)
      setError(
        cause instanceof Error
          ? cause.message
          : 'The request could not complete.',
      )
  }
  async function commit(next: Cut) {
    await saveCut(owner, next)
    current.current = next
    if (alive.current) setCut(next)
  }
  function changePrompt(value: string) {
    setPrompt(value)
    try {
      localStorage.setItem(draftKey(owner), value)
    } catch {
      setError('Your draft could not be saved locally.')
    }
  }

  async function recover(pending: PendingClip, attempt = ++run.current) {
    if (!pending.token || !isCurrent(attempt)) return
    working.current = true
    setBusy(true)
    setError(null)
    let scheduled = false
    try {
      setStatus('Checking existing generation…')
      const state = await checkClip(pending.token)
      if (!isCurrent(attempt)) return
      if (state !== 'COMPLETED') {
        if (Date.now() - pending.startedAt > 10 * 60 * 1000)
          throw new Error(
            'This generation is taking longer than expected. Check request again later; it will not submit another job.',
          )
        setStatus(
          state === 'IN_QUEUE'
            ? 'Queued · existing cut keeps looping'
            : 'Generating · existing cut keeps looping',
        )
        scheduled = true
        pollTimer.current = setTimeout(() => {
          pollTimer.current = null
          void recover(pending, attempt)
        }, 1200)
        return
      }
      setStatus('Saving clip and preparing its ending frame…')
      const response = await fetch('/lab/director/media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: pending.token }),
      })
      if (!response.ok)
        throw new Error(
          'Could not download this result. Use Check request to retry without generating again.',
        )
      const blob = await response.blob()
      const frame = await clipFrame(blob)
      if (!isCurrent(attempt)) return
      const clip: Clip = {
        id: pending.id,
        prompt: pending.prompt,
        blob,
        ...frame,
        model: pending.settings.model,
        elapsedMs: Date.now() - pending.startedAt,
      }
      await commit(completeClip(current.current, pending, clip))
      localStorage.removeItem(`${draftKey(owner)}-receipt`)
      setStatus(
        pending.redo
          ? 'Latest section replaced · playback continues'
          : 'Section added · playback continues',
      )
    } catch (cause) {
      report(cause)
      if (isCurrent(attempt))
        setStatus('Request retained · check again without spending again')
    } finally {
      if (isCurrent(attempt) && !scheduled) {
        working.current = false
        setBusy(false)
      }
    }
  }

  async function submit(redo: boolean) {
    if (!ready || working.current || current.current.pending || !prompt.trim())
      return
    working.current = true
    setBusy(true)
    setError(null)
    const text = prompt.trim()
    let submitted = false
    try {
      if (text.length > PROMPT_LIMIT)
        throw new Error('Please shorten this direction.')
      const base = generationBase(current.current, redo)
      const pending: PendingClip = {
        id: crypto.randomUUID(),
        prompt: text,
        context: base.context,
        settings: { ...current.current.settings },
        redo,
        startedAt: Date.now(),
      }
      // Persist intent before spending. Missing receipt after interruption is
      // uncertain, never permission to automatically repeat a paid request.
      await commit({ ...current.current, pending })
      setStatus(`Submitting one ${pending.settings.duration}-second clip…`)
      const data = new FormData()
      data.set(
        'request',
        JSON.stringify({
          prompt: text,
          context: base.context,
          settings: pending.settings,
        }),
      )
      if (base.image) data.set('frame', base.image, 'starting-frame.png')
      submitted = true
      const token = await submitClip(data)
      const accepted = { ...pending, token }
      current.current = { ...current.current, pending: accepted }
      if (alive.current) setCut(current.current)
      // Small receipt backup if saving a media-heavy cut runs out of quota.
      try {
        localStorage.setItem(
          `${draftKey(owner)}-receipt`,
          JSON.stringify(accepted),
        )
      } catch {
        /* IndexedDB below is the primary receipt store. */
      }
      await commit(current.current)
      if (!alive.current) return
      changePrompt('')
      await recover(accepted)
    } catch (cause) {
      report(cause)
      if (alive.current)
        setStatus(
          submitted
            ? 'Submission interrupted · do not automatically resubmit'
            : 'Could not prepare request',
        )
    } finally {
      if (alive.current && !pollTimer.current) {
        working.current = false
        setBusy(false)
      }
    }
  }

  async function changeSettings(settings: Settings) {
    if (!ready || working.current || current.current.pending) return
    working.current = true
    setBusy(true)
    try {
      await commit({ ...current.current, settings })
    } catch (cause) {
      report(cause)
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  async function changeImage(file: File | null) {
    if (
      !ready ||
      working.current ||
      current.current.clips.length ||
      current.current.pending
    )
      return
    working.current = true
    setBusy(true)
    try {
      if (
        file &&
        (!file.size ||
          file.size > 15 * 1024 * 1024 ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      )
        throw new Error('Choose a JPEG, PNG or WebP under 15 MB.')
      await commit({ ...current.current, initialImage: file })
    } catch (cause) {
      report(cause)
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  async function forgetPending() {
    if (!ready || working.current) return
    working.current = true
    setBusy(true)
    try {
      await commit({ ...current.current, pending: null })
      localStorage.removeItem(`${draftKey(owner)}-receipt`)
      setStatus(
        'Request dismissed locally; any provider job may still finish and be billed',
      )
      setError(null)
    } catch (cause) {
      report(cause)
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  async function clearSession() {
    if (!ready || working.current || current.current.pending) return
    working.current = true
    setBusy(true)
    try {
      // Empty cut is a tombstone preventing old recordings being re-imported.
      await commit(emptyCut())
      changePrompt('')
      await clearLocalSession(owner)
      writeSession(localStorage, owner, emptySession())
      sessionStorage.removeItem(`genzen-director-journal-${owner}`)
      localStorage.removeItem(`${draftKey(owner)}-receipt`)
      setArchives([])
      setError(null)
      setStatus('New cut · ready')
    } catch (cause) {
      report(cause)
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    alive.current = true
    let cancelled = false
    const wasCancelled = () => cancelled
    let release: (() => void) | undefined
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    async function restore() {
      const [saved, takes] = await Promise.all([
        readCut(owner),
        listTakes(owner),
      ])
      if (wasCancelled()) return
      setArchives(takes)
      const next = saved ?? emptyCut()
      let draft = localStorage.getItem(draftKey(owner))
      if (!saved) {
        const legacy = readSession(localStorage, owner)
        draft ??= legacy?.draft ?? ''
        next.initialImage = await readInitialImage(owner)
        const selected =
          takes.find((take) => take.id === legacy?.previewId) ??
          [...takes].sort((a, b) => b.startedAt - a.startedAt).at(0)
        if (selected?.blob.size) {
          try {
            const frame = await clipFrame(selected.blob)
            next.clips = [
              {
                id: selected.id,
                blob: selected.blob,
                ...frame,
                prompt: (
                  legacy?.directions
                    .map((direction) => direction.prompt)
                    .join('\n') || 'Saved Director scene'
                ).slice(0, PROMPT_LIMIT),
                model: 'Director recording',
                imported: true,
              },
            ]
          } catch (cause) {
            report(cause)
          }
        }
      }
      const receipt = localStorage.getItem(`${draftKey(owner)}-receipt`)
      if (receipt && next.pending) {
        const accepted = JSON.parse(receipt) as PendingClip
        if (
          accepted.id === next.pending.id &&
          typeof accepted.token === 'string'
        )
          next.pending = { ...next.pending, token: accepted.token }
      }
      if (wasCancelled()) return
      await commit(next)
      if (wasCancelled()) return
      setPrompt(draft ?? '')
      setReady(true)
      setStatus(
        next.clips.length
          ? 'Saved cut restored · ready to continue'
          : `Ready · ${next.settings.duration}-second clips`,
      )
      if (next.pending?.token) void recover(next.pending)
      else if (next.pending)
        setStatus(
          'An interrupted submission has no receipt. Check FAL before dismissing it or submitting again.',
        )
    }
    // Only one editing tab can own this account's local cut.
    if (!('locks' in navigator)) {
      setError(
        'This experiment needs a browser with Web Locks. Use a current desktop browser.',
      )
    } else {
      void navigator.locks.request(
        `genzen-director-cut-${owner}`,
        { ifAvailable: true },
        async (lock) => {
          if (cancelled) return
          if (!lock) {
            setError(
              'Director is already open in another tab. Close that tab and reload here.',
            )
            return
          }
          try {
            await restore()
            await hold
          } catch (cause) {
            report(cause)
          }
        },
      )
    }
    return () => {
      cancelled = true
      alive.current = false
      ++run.current
      if (pollTimer.current) clearTimeout(pollTimer.current)
      pollTimer.current = null
      release?.()
    }
  }, [owner])

  return {
    cut,
    prompt,
    setPrompt: changePrompt,
    ready,
    busy,
    error,
    status,
    archives,
    submit,
    changeSettings,
    changeImage,
    clearSession,
    forgetPending,
    checkRequest: () => {
      if (current.current.pending && !working.current)
        void recover(current.current.pending)
    },
  }
}
