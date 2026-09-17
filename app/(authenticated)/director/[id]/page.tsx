import { notFound } from 'next/navigation'
import { getSession } from '../_lib/sessions.server'
import { listSessionRefs } from '../_actions/references.action'
import {
  listBoardFrames,
  settleBoardTakes,
} from '../_actions/storyboard.action'
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
  /* The clips, the sheets and the storyboard's frames, all read here: a tab's
     assets are library rows like the clips are, and every change to them ends
     in a `router.refresh()` that comes back through this function (#690). The
     board itself is a column on the session row and arrives with it. */
  /* Before the frames are read, not beside them: a take that finished while
     nobody was looking should be a picture on this render rather than on the
     next one (#697). */
  await settleBoardTakes(session.id)
  const [clips, refs, frames] = await Promise.all([
    listVideos('director'),
    listSessionRefs(session.id),
    listBoardFrames(session.id),
  ])
  return (
    <View
      key={session.id}
      session={session}
      clips={clips}
      refs={refs}
      frames={frames}
    />
  )
}
