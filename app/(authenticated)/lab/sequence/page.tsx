import { listVideos } from '../../video/_actions/generate-video.action'
import { View } from './view'

/**
 * Only finished clips, the same rule Frames applies: a pending or failed row
 * has no object behind `/img/[id]`, so it is a card you can pick and get a
 * blank stage out of.
 */
export default async function LabSequencePage() {
  const clips = await listVideos()
  return <View clips={clips.filter((c) => c.status === 'completed')} />
}
