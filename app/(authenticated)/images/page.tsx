import { ImagesPage } from './_components/images-page/images-page'
import { listGalleryImages } from '#/features/ai-images/server/gallery.actions'

export default async function Images() {
  const initial = await listGalleryImages()
  return <ImagesPage initial={initial} />
}
