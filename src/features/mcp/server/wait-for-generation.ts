import { pollFalRecord } from './poll-fal-record'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'

const DEFAULT_TIMEOUT_MS = 90_000
const DEFAULT_INTERVAL_MS = 1_500

export interface CompletedGeneration {
  id: string
  storage_path: string | null
  generation_metadata: Record<string, unknown> | null
  title: string | null
}

/**
 * Polls user_images by id+userId until status flips from `pending` to
 * `completed` (returns the row), `failed` (throws with the FAL error
 * message if available), or the timeout elapses (throws timeout).
 *
 * Used by the MCP generation tools to make async FAL submissions feel
 * synchronous to the calling agent.
 */
export async function waitForGeneration(
  userId: string,
  recordId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<CompletedGeneration> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const supabase = getSupabaseAdmin()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    // Poll FAL ourselves and let it flip the DB row if the job is done.
    // Nothing else polls FAL on the MCP path — the browser path relies on
    // checkPendingGenerations being called by UI hooks.
    await pollFalRecord(recordId)

    const { data, error } = await supabase
      .from('user_images')
      .select('id, status, storage_path, generation_metadata, title')
      .eq('id', recordId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(`Polling failed: ${error.message}`)
    if (!data) throw new Error('Generation record not found')

    if (data.status === 'completed') {
      return {
        id: data.id,
        storage_path: data.storage_path,
        generation_metadata: data.generation_metadata as Record<
          string,
          unknown
        > | null,
        title: data.title,
      }
    }

    if (data.status === 'failed') {
      const meta = (data.generation_metadata ?? {}) as Record<string, unknown>
      const message =
        typeof meta.error === 'string' ? meta.error : 'Generation failed'
      const err = new Error(message) as Error & { recordId?: string }
      err.recordId = recordId
      throw err
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  const err = new Error(
    `Generation timed out after ${Math.round(timeoutMs / 1000)}s. The job may still complete in the background — check /dashboard/activity.`,
  ) as Error & { recordId?: string }
  err.recordId = recordId
  throw err
}

export function buildPublicUrl(storagePath: string | null): string | null {
  if (!storagePath) return null
  const base = process.env.VITE_R2_PUBLIC_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/${storagePath}`
}
