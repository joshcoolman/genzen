import { createFileRoute } from '@tanstack/react-router'
import { UserImagesDisplay } from '@/features/user-images'

export const Route = createFileRoute('/dashboard/images')({
  validateSearch: (search: Record<string, unknown>) => ({
    imageId: typeof search.imageId === 'string' ? search.imageId : undefined,
  }),
  component: ImagesPage,
})

function ImagesPage() {
  const { imageId } = Route.useSearch()
  return <UserImagesDisplay deepLinkImageId={imageId} />
}
