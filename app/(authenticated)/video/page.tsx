import { listVideos } from './_actions/generate-video.action'
import { View } from './view'
import { listGalleryImages } from '#/features/ai-images/server/gallery.action'

export default async function Video() {
  const [videos, images] = await Promise.all([
    listVideos(),
    listGalleryImages(),
  ])

  return (
    <View
      initialVideos={videos}
      sources={images
        .filter((image) => image.status === 'completed')
        .slice(0, 60)
        .map((image) => ({ id: image.id, title: image.title }))}
    />
  )
}
