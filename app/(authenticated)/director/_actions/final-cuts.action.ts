'use server'

import { z } from 'zod'
import {
  createFinalCut,
  deleteFinalCut,
  getFinalCut,
  listFinalCuts,
  resumeFinalCut,
  stopFinalCut,
} from '../_lib/final-cuts.server'
import { finalCutSummary } from '../_lib/final-cut'
import { scheduleFinalCut } from '../_lib/final-runner.server'
import { idSchema } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { requireAiRole } from '#/lib/server/ai.server'
import { assertFalKey } from '#/lib/server/fal-key.server'

export async function startFinalCut(
  sessionId: string,
  exportId: string,
  id: string,
) {
  const owner = (await resolveAuth()).userId
  try {
    requireAiRole('vision')
    assertFalKey()
    const item = await createFinalCut(
      owner,
      idSchema.parse(sessionId),
      idSchema.parse(exportId),
      idSchema.parse(id),
    )
    if (item.status === 'queued' || item.status === 'running')
      scheduleFinalCut(owner, item.id)
    return { item: finalCutSummary(item), error: null }
  } catch (error) {
    return {
      item: null,
      error:
        error instanceof Error ? error.message : 'Could not start Final Cut.',
    }
  }
}
export async function loadFinalCuts(sessionId: string) {
  const owner = (await resolveAuth()).userId
  const items = await listFinalCuts(owner, idSchema.parse(sessionId))
  for (const item of items) {
    if (
      (item.status === 'queued' || item.status === 'running') &&
      (!item.lease_until || new Date(item.lease_until).getTime() < Date.now())
    )
      scheduleFinalCut(owner, item.id)
  }
  return items.map(finalCutSummary)
}
export async function manageFinalCut(id: string, command: string) {
  const owner = (await resolveAuth()).userId
  try {
    idSchema.parse(id)
    const action = z.enum(['resume', 'stop', 'delete']).parse(command)
    if (!(await getFinalCut(owner, id))) throw new Error('Final Cut not found.')
    if (action === 'resume') {
      requireAiRole('vision')
      assertFalKey()
      await resumeFinalCut(owner, id)
      scheduleFinalCut(owner, id)
    } else if (action === 'stop') await stopFinalCut(owner, id)
    else await deleteFinalCut(owner, id)
    return { error: null }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not update Final Cut.',
    }
  }
}
