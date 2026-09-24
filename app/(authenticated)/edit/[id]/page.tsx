import { notFound } from 'next/navigation'
import { getEdit, listEditFrames } from '../_lib/edits.server'
import { listVideos } from '../../video/_actions/generate-video.action'
import { View } from './view'
import { resolveAuth } from '#/lib/server/auth.server'

/**
 * An edit picks from the Video wall (#726), and only from clips that exist:
 * a pending row has nothing behind `/img/[id]` to trim.
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
  const clips = videos.filter((c) => c.status === 'completed')
  return <View key={edit.id} edit={edit} clips={clips} frames={frames} />
}
