'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  deriveReference,
  dropReference,
  extractReferences,
} from '../_actions/references.action'
import { DERIVE_MODEL_SLUGS } from './refs'
import type { RefAsset } from '../_actions/references.action'
import type { RefKind } from '../_lib/types'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { useReportError } from '#/components'

export type SessionTab = 'work' | RefKind

/**
 * The Characters and Locations tabs (#690).
 *
 * **The assets are props, never state.** They are library rows read by the
 * page, so every change here ends in `router.refresh()` and the server hands
 * back what is actually there -- which is also how a sheet still being made
 * turns into a picture. Holding a copy would mean reconciling a pending row
 * against its own settled self, which is the bug `use-gallery` exists to
 * avoid; there is no arrangement to protect here, so there is nothing to hold.
 *
 * Beside `use-view` rather than inside it: that hook is the run, and a tab
 * that does not touch the run has no business growing it.
 */
export function useReferences(
  sessionId: string,
  assets: Record<RefKind, Array<RefAsset>>,
) {
  const router = useRouter()
  const report = useReportError()
  const [tab, setTab] = useState<SessionTab>('work')
  const [busy, setBusy] = useState<RefKind | null>(null)
  /** The sheet New from this is open on, or null. */
  const [deriving, setDeriving] = useState<RefAsset | null>(null)
  const [words, setWords] = useState('')
  const [models, setModels] = useState<Array<string>>([DERIVE_MODEL_SLUGS[0]])
  const [submitting, setSubmitting] = useState(false)

  const all = useMemo(
    () => [...assets.characters, ...assets.locations],
    [assets],
  )

  /* The standard poll, on the oldest sheet still being made. A sheet is an
     ordinary generation, so nothing here is special -- it lands when FAL
     answers and the refresh draws it. */
  const pendingSince = useMemo(() => {
    const pending = all
      .filter((asset) => asset.status === 'pending')
      .map((asset) => asset.created_at)
      .sort()
    return pending[0] ?? null
  }, [all])
  useGenerationPoll(pendingSince, () => router.refresh())

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      try {
        await work()
        router.refresh()
        return true
      } catch (cause) {
        /* Through `useReportError`, which toasts the reason and -- when the
           reason is a missing Anthropic key -- opens the key dialog instead.
           The inventory is a Claude call and that key is usually empty
           locally, so this is the common failure rather than an exotic one. */
        report(cause, 'That did not work.')
        return false
      }
    },
    [report, router],
  )

  const extract = useCallback(
    async (kind: RefKind) => {
      if (busy) return
      setBusy(kind)
      await run(() => extractReferences(sessionId, kind))
      setBusy(null)
    },
    [busy, run, sessionId],
  )

  const openDerive = useCallback((asset: RefAsset) => {
    setDeriving(asset)
    setWords('')
  }, [])

  const derive = useCallback(async () => {
    if (!deriving || submitting) return
    setSubmitting(true)
    const ok = await run(() =>
      deriveReference(sessionId, deriving.id, words, models),
    )
    setSubmitting(false)
    if (ok) setDeriving(null)
  }, [deriving, models, run, sessionId, submitting, words])

  const drop = useCallback(
    async (asset: RefAsset) => {
      await run(() => dropReference(sessionId, asset.id))
    },
    [run, sessionId],
  )

  const toggleModel = useCallback((slug: string) => {
    setModels((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug],
    )
  }, [])

  return {
    tab,
    setTab,
    busy,
    extract,
    deriving,
    setDeriving,
    words,
    setWords,
    models,
    toggleModel,
    submitting,
    derive,
    openDerive,
    drop,
  }
}
