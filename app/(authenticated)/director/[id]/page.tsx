import { notFound } from 'next/navigation'
import { getSession } from '../_lib/sessions.server'
import { listVideos } from '../../video/_actions/generate-video.action'
import { View } from './view'
import { resolveAuth } from '#/lib/server/auth.server'

/**
 * Every Director clip, finished or not.
 *
 * Director's scope only (#679): a session holds clips born in a session and
 * nothing off the Video wall. Pending rows are included on purpose -- a clip
 * generated from inside the run is pending for a minute or two, and filtering
 * it out here would mean the thing you just paid for vanishing from the page
 * until it finished.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await resolveAuth()
  const session = await getSession(userId, (await params).id)
  if (!session) notFound()
  return (
    <View
      key={session.id}
      session={session}
      clips={await listVideos('director')}
    />
  )
}
