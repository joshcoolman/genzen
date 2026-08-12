import { View } from './view'
import { listGalleryImages } from '#/features/ai-images/server/gallery.action'

export default async function Explore() {
  const initial = await listGalleryImages()
  return <View initial={initial} />
}
