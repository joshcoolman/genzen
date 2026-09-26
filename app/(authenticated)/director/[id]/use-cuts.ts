'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { newCut, removeCut, switchCut } from '../_actions/sessions.action'
import { cutFromScript } from '../_actions/rerun.action'
import type { Session } from '../_lib/types'
import { toast, useReportError } from '#/components'

/**
 * The cut tabs (#744): add one, open one, delete one.
 *
 * Each is a server write followed by a refresh, and the page is keyed on the
 * open cut, so opening another remounts the workspace on it -- the player, the
 * row and every held draft start over on the new run rather than carrying one
 * cut's state into another. `afterSaves` puts the write behind any reorder
 * still being saved.
 */
export function useCuts(
  session: Session,
  afterSaves: (write: () => Promise<Session>) => Promise<Session>,
) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  /** Whether a cut is being written from script -- tens of seconds of model
   *  calls before the first shot is submitted, so it says so. */
  const [writing, setWriting] = useState(false)
  const reportError = useReportError()

  const run = useCallback(
    async (write: () => Promise<Session>, failure: string) => {
      setBusy(true)
      try {
        await afterSaves(write)
        router.refresh()
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : failure)
      } finally {
        setBusy(false)
      }
    },
    [afterSaves, router],
  )

  return {
    cuts: session.cuts.cuts,
    active: session.cut.id,
    busy,
    add: () => run(() => newCut(session.id), 'The cut could not be added.'),
    open: (cutId: string) =>
      cutId === session.cut.id
        ? Promise.resolve()
        : run(
            () => switchCut(session.id, cutId),
            'The cut could not be opened.',
          ),
    writing,
    /** New cut from script: a missing Anthropic key opens the key dialog. */
    fromScript: async () => {
      setBusy(true)
      setWriting(true)
      try {
        await afterSaves(() => cutFromScript(session.id))
        router.refresh()
      } catch (cause) {
        reportError(cause, 'The cut could not be made.')
      } finally {
        setBusy(false)
        setWriting(false)
      }
    },
    remove: (cutId: string) =>
      run(() => removeCut(session.id, cutId), 'The cut could not be deleted.'),
  }
}
