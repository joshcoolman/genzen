import { View } from './view'
import { GALLERY_SEED_LIMIT } from '#/features/ai-images/gallery-seed'
import { listGalleryImages } from '#/features/ai-images/server/gallery.action'

// Bounded, because this read is not only the first paint's: a server action
// re-renders the route it was called from, so every delete, group write and
// poll tick re-runs it (#328). `use-view` completes the list when the seed
// comes back full.
export default async function Images() {
  const initial = await listGalleryImages({ limit: GALLERY_SEED_LIMIT })
  return <View initial={initial} />
}
