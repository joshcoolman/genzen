import { listVideos } from '../../video/_actions/generate-video.action'
import { View } from './view'

/**
 * Only finished clips, the same rule Sequence and Frames apply: a pending or
 * failed row has no object behind `/img/[id]`, so it is a card you can put on
 * the timeline and get nothing out of.
 */
export default async function LabEditorPage() {
  const clips = await listVideos()
  return <View clips={clips.filter((c) => c.status === 'completed')} />
}
