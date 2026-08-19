import { listVideos } from '../../video/_actions/generate-video.action'
import { View } from './view'

/**
 * Only finished clips: a pending or failed row has no object behind `/img/[id]`
 * to seek into, so it is a card you can select and get nothing out of.
 */
export default async function LabFramesPage() {
  const clips = await listVideos()
  return <View clips={clips.filter((c) => c.status === 'completed')} />
}
