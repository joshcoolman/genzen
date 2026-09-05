import 'server-only'
import { randomUUID } from 'node:crypto'
import { assertFinalSource, rejectedWork, uncertainWork } from './final-cut'
import { getExport } from './exports.server'
import type { FinalCut, FinalOutput, FinalWork } from './final-cut'
import { first, jsonb, sql } from '#/lib/server/db.server'
import { createImageStorage } from '#/lib/image-storage'

export async function getFinalCut(owner: string, id: string) {
  return first(
    await sql<
      Array<FinalCut>
    >`select id, session_id, export_id, status, stage, error, work, output,
    lease_id, lease_until, to_json(created_at)#>>'{}' as created_at from director_final_cuts
    where user_id = ${owner} and id = ${id}`,
  )
}
export async function listFinalCuts(owner: string, sessionId: string) {
  return sql<
    Array<FinalCut>
  >`select id, session_id, export_id, status, stage, error, work, output,
    lease_id, lease_until, to_json(created_at)#>>'{}' as created_at from director_final_cuts
    where user_id = ${owner} and session_id = ${sessionId} order by created_at`
}
export async function createFinalCut(
  owner: string,
  sessionId: string,
  exportId: string,
  id: string,
) {
  const source = await getExport(owner, sessionId, exportId)
  if (!source) throw new Error('Export not found.')
  assertFinalSource(source)
  await sql.begin(async (tx) => {
    // Serialize against deletion and concurrent starts, including other sessions.
    await tx`select id from users where id = ${owner} for update`
    const parent = first(
      await tx`select id from director_sessions where user_id = ${owner} and id = ${sessionId} for update`,
    )
    if (!parent) throw new Error('Session not found.')
    const item = first(
      await tx`select id from director_exports where user_id = ${owner} and session_id = ${sessionId} and id = ${exportId}`,
    )
    if (!item) throw new Error('Export not found.')
    const existing = first(
      await tx`select id from director_final_cuts where user_id = ${owner} and id = ${id} and export_id = ${exportId}`,
    )
    if (existing) return
    const active = first(
      await tx`select id from director_final_cuts where user_id = ${owner}
      and (status in ('queued', 'running') or lease_until > now())`,
    )
    if (active)
      throw new Error(
        'Another Final Cut is still running. Wait or stop it before starting another.',
      )
    await tx`insert into director_final_cuts (id, session_id, user_id, export_id)
      values (${id}, ${sessionId}, ${owner}, ${exportId})`
  })
  const item = await getFinalCut(owner, id)
  if (!item) throw new Error('Final Cut could not be saved.')
  return item
}
export async function claimFinalCut(owner: string, id: string) {
  const lease = randomUUID()
  const row = first(
    await sql<Array<FinalCut>>`update director_final_cuts
    set status = 'running', lease_id = ${lease}, lease_until = now() + interval '90 seconds', updated_at = now()
    where user_id = ${owner} and id = ${id} and status in ('queued', 'running')
      and (lease_until is null or lease_until < now())
    returning *, to_json(created_at)#>>'{}' as created_at`,
  )
  return row
}
export async function renewFinalCut(owner: string, id: string, lease: string) {
  const rows =
    await sql`update director_final_cuts set lease_until = now() + interval '90 seconds'
    where user_id = ${owner} and id = ${id} and lease_id = ${lease} and status = 'running' and lease_until > now() returning id`
  return rows.length > 0
}
export async function checkpointFinalCut(
  owner: string,
  id: string,
  lease: string,
  stage: string,
  work: FinalWork,
) {
  const rows =
    await sql`update director_final_cuts set stage = ${stage}, work = ${jsonb(work)}, updated_at = now()
    where user_id = ${owner} and id = ${id} and lease_id = ${lease} and status = 'running' and lease_until > now() returning id`
  if (!rows.length)
    throw new Error('Final Cut stopped or its worker lease expired.')
}
export async function finishFinalCut(
  owner: string,
  id: string,
  lease: string,
  output: FinalOutput,
) {
  const rows =
    await sql`update director_final_cuts set status = 'complete', stage = 'Ready', output = ${jsonb(output)},
    error = null, updated_at = now() where user_id = ${owner} and id = ${id} and lease_id = ${lease}
    and status = 'running' and lease_until > now() returning id`
  if (!rows.length) throw new Error('Final Cut stopped before publication.')
}
export async function failFinalCut(
  owner: string,
  id: string,
  lease: string,
  error: string,
) {
  await sql`update director_final_cuts set status = 'failed', error = ${error.slice(0, 1000)}, updated_at = now()
    where user_id = ${owner} and id = ${id} and lease_id = ${lease} and status = 'running'`
}
export async function releaseFinalCut(
  owner: string,
  id: string,
  lease: string,
) {
  await sql`update director_final_cuts set lease_id = null, lease_until = null
    where user_id = ${owner} and id = ${id} and lease_id = ${lease}`
}
export async function resumeFinalCut(owner: string, id: string) {
  const item = await getFinalCut(owner, id)
  if (!item) throw new Error('Final Cut not found.')
  await sql.begin(async (tx) => {
    await tx`select id from users where id = ${owner} for update`
    await tx`select id from director_sessions where user_id = ${owner} and id = ${item.session_id} for update`
    const row = first(
      await tx<
        Array<FinalCut>
      >`select * from director_final_cuts where user_id = ${owner} and id = ${id} for update`,
    )
    if (!row || row.status !== 'failed')
      throw new Error('This Final Cut cannot be resumed.')
    if (uncertainWork(row.work))
      throw new Error(
        'A paid request has no saved receipt. Check the provider before starting a new Final Cut.',
      )
    if (rejectedWork(row.work))
      throw new Error(
        'The provider rejected this attempt. Start a new Final Cut after resolving the reported problem.',
      )
    const active = first(
      await tx`select id from director_final_cuts where user_id = ${owner} and (status in ('queued', 'running') or lease_until > now())`,
    )
    if (active) throw new Error('Another Final Cut is still running.')
    await tx`update director_final_cuts set status = 'queued', error = null, stage = 'Resuming', updated_at = now()
      where user_id = ${owner} and id = ${id}`
  })
}
export async function stopFinalCut(owner: string, id: string) {
  await sql`update director_final_cuts set status = 'cancelled', stage = 'Stopped', updated_at = now()
    where user_id = ${owner} and id = ${id} and status in ('queued', 'running', 'failed')`
}
export async function deleteFinalCut(owner: string, id: string) {
  const item = await getFinalCut(owner, id)
  if (!item) throw new Error('Final Cut not found.')
  await sql.begin(async (tx) => {
    await tx`select id from director_sessions where user_id = ${owner} and id = ${item.session_id} for update`
    const row = first(
      await tx<
        Array<{ busy: boolean }>
      >`select (status in ('queued', 'running') or coalesce(lease_until > now(), false)) as busy
      from director_final_cuts where user_id = ${owner} and id = ${id} for update`,
    )
    if (!row) return
    if (row.busy)
      throw new Error(
        'Stop this Final Cut and wait for its worker to finish before deleting it.',
      )
    const media = await tx<
      Array<{ storage_path: string }>
    >`select storage_path from director_media where user_id = ${owner} and final_cut_id = ${id}`
    for (let offset = 0; offset < media.length; offset += 500)
      await createImageStorage().remove(
        media.slice(offset, offset + 500).map((asset) => asset.storage_path),
      )
    await tx`delete from director_final_cuts where user_id = ${owner} and id = ${id}`
  })
}
