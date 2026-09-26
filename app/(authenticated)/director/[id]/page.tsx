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
  /* Started, never awaited (#707). Settling is up to four sequential 16MB
     downloads and re-uploads, and awaiting it here held the whole page behind
     them -- Work, Script, Characters and Locations, none of which reads a
     take, waiting tens of seconds on work only the storyboard wants.
     #697 made the opposite trade for a real reason: a take that finished while
     nobody was looking is a picture on this render rather than the next one.
     That reason still stands and is now simply the cheaper thing to give up --
     `useGenerationPoll` in `use-storyboard` already settles the row a cycle
     later, exactly as it does for every other pending row in the app, so the
     one tab that cares waits a cycle instead of four tabs waiting on its
     download. The call itself is unchanged: the asking is what had gone
     missing, and it still happens on every load. */
  void settleBoardTakes(session.id).catch((cause: unknown) => {
    /* Nothing on the page is rendered from it, so there is nobody to tell:
       a take it could not reach stays pending and the poll asks again. Logged
       rather than swallowed because a floating promise that throws silently is
       how a settle path stops running without anyone noticing -- which is the
       twenty-two-minute failure `settleBoardTakes` exists to answer. */
    console.error('[director] settling the board failed', session.id, cause)
  })
  const [clips, refs, frames] = await Promise.all([
    listVideos('director'),
    listSessionRefs(session.id),
    listBoardFrames(session.id),
  ])
  return (
    <View
      /* Keyed on the open cut too (#744): opening another remounts the
         workspace on its run rather than carrying one cut's state into it. */
      key={`${session.id}:${session.cut.id}`}
      session={session}
      clips={clips}
      refs={refs}
      frames={frames}
    />
  )
}
