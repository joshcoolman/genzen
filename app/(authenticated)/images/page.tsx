import { View } from './view'
import { listGalleryImages } from '#/features/ai-images/server/gallery.actions'

export default async function Images() {
  const initial = await listGalleryImages()
  return <View initial={initial} />
}
