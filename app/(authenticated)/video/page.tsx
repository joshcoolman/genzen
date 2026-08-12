import { listVideos } from './_actions/generate-video.action'
import { View } from './view'

export default async function Video() {
  return <View initialVideos={await listVideos()} />
}
