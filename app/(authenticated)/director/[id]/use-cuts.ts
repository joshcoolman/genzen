'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { newCut, removeCut, switchCut } from '../_actions/sessions.action'
import type { Session } from '../_lib/types'
import { toast } from '#/components'

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
    remove: (cutId: string) =>
      run(() => removeCut(session.id, cutId), 'The cut could not be deleted.'),
  }
}
