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
import type { ViewerItem } from '#/components'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { useReportError } from '#/components'
import { imageUrl } from '#/lib/image-url'

/** The tabs a session can show. `script` is the run's dialogue and exists
 *  only for a chat, whose clip prompts have a line in them to find (#690);
 *  `storyboard` is the frames planned from that script and the sheets, and
 *  needs all three to exist before it has anything to build from (#695). */
export type SessionTab = 'work' | 'script' | 'storyboard' | RefKind

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
  /** Which sheet the lightbox is on, within the open tab. */
  const [viewing, setViewing] = useState<number | null>(null)

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

  /**
   * The lightbox's cursor, over the open tab alone.
   *
   * **Its own, not `useImageViewer`.** That hook stayed in Images on its own
   * warning -- sharing a cursor is what once imposed a prompt column and a
   * filmstrip on the viewer -- and it is the right call: a cursor carries the
   * rules of the surface it belongs to, and the two disagree on all of them.
   * Its set is a filtered, scoped, sorted gallery; this one is a tab. Its
   * Delete has a safe twin in Hide; here there is no hiding, because the whole
   * mechanism is prune-by-deleting. What is shared is the shell, which takes
   * the same four props from either.
   *
   * Only the finished sheets: a pending tile is not something the lightbox can
   * show, and "next" landing on a spinner is a dead stop in the middle of a
   * pass.
   */
  const shown = useMemo(() => {
    /* Checked positively rather than by excluding the other tabs: only a
       positive test narrows the union to a key of `assets`. */
    const list = tab === 'characters' || tab === 'locations' ? assets[tab] : []
    return list.filter((a) => a.status === 'completed')
  }, [assets, tab])
  const viewerItems: Array<ViewerItem> = useMemo(
    () =>
      shown.map((asset) => ({
        id: asset.id,
        title: asset.title,
        prompt: asset.description ?? undefined,
      })),
    [shown],
  )
  const viewerUrls = useMemo(
    () => Object.fromEntries(shown.map((a) => [a.id, imageUrl(a.id)])),
    [shown],
  )

  const openViewer = useCallback(
    (asset: RefAsset) => {
      const index = shown.findIndex((a) => a.id === asset.id)
      if (index !== -1) setViewing(index)
    },
    [shown],
  )
  /* A ring, both ways, as the Images viewer is: a chevron that does nothing on
     the last sheet reads as broken. */
  const viewerNext = useCallback(
    () => setViewing((i) => (i === null ? null : (i + 1) % shown.length)),
    [shown.length],
  )
  const viewerPrev = useCallback(
    () =>
      setViewing((i) =>
        i === null ? null : (i - 1 + shown.length) % shown.length,
      ),
    [shown.length],
  )

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

  /**
   * Delete from inside the lightbox, and carry on through the tab.
   *
   * The cursor moves *before* the delete, because the list it is cycling is
   * about to be one shorter -- `actAndAdvance`'s reasoning in Images, and the
   * same payoff: the next sheet slides into the place the last one was, so a
   * pass over an extraction is a run of single presses.
   */
  const dropViewed = useCallback(async () => {
    if (viewing === null) return
    /* The index really can outrun the list -- the poll refreshes the page
       while the lightbox is open -- and TS is not checking indexed access, so
       the cast is what lets the guard exist. Same reason `ImageViewer` casts
       its own current item. */
    const asset = shown[viewing] as RefAsset | undefined
    if (!asset) return
    const remaining = shown.length - 1
    if (remaining === 0) setViewing(null)
    else if (viewing >= remaining) setViewing(remaining - 1)
    await drop(asset)
  }, [drop, shown, viewing])

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
    viewing,
    viewerItems,
    viewerUrls,
    openViewer,
    closeViewer: useCallback(() => setViewing(null), []),
    viewerNext,
    viewerPrev,
    dropViewed,
  }
}
