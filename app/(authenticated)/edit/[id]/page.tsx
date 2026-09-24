import { notFound } from 'next/navigation'
import { getEdit, listEditFrames } from '../_lib/edits.server'
import { listVideos } from '../../video/_actions/generate-video.action'
import { View } from './view'
import { resolveAuth } from '#/lib/server/auth.server'

/**
 * An edit picks from the Video wall (#726). Pending rows come through too
 * (#731): a clip Continue is making holds its place on the strip until the
 * poll settles it, and filtering it out here would empty that place on every
 * refresh. Failed rows do not -- the hook drops them and says so.
 */
export default async function EditWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await resolveAuth()
  const edit = await getEdit(userId, (await params).id)
  if (!edit) notFound()
  const [videos, frames] = await Promise.all([
    listVideos(),
    listEditFrames(userId, edit.group_id),
  ])
  const clips = videos.filter((c) => c.status !== 'failed')
  return <View key={edit.id} edit={edit} clips={clips} frames={frames} />
}
