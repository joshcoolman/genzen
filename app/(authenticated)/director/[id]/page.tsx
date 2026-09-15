import { notFound } from 'next/navigation'
import { getSession } from '../_lib/sessions.server'
import { listVideos } from '../../video/_actions/generate-video.action'
import { View } from './view'
import { resolveAuth } from '#/lib/server/auth.server'

/**
 * Every clip, finished or not.
 *
 * It used to filter to `completed`, on the rule Frames applies: a pending row
 * has no object behind `/img/[id]`, so it is a card you can pick and get a
 * blank stage out of. The rule still holds and has moved one level in (#660) --
 * the picker is offered `completed` only, by `use-view`. The run itself needs
 * the others: a clip generated from inside the run is pending for a minute or
 * two, and filtering it out here would mean the thing you just paid for
 * vanishing from the page until it finished.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await resolveAuth()
  const session = await getSession(userId, (await params).id)
  if (!session) notFound()
  return <View key={session.id} session={session} clips={await listVideos()} />
}
