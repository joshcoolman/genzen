import { createFileRoute } from '@tanstack/react-router'
import { UserImagesDisplay } from '@/features/user-images'

export const Route = createFileRoute('/dashboard/assets')({
  validateSearch: (search: Record<string, unknown>) => ({
    imageId: typeof search.imageId === 'string' ? search.imageId : undefined,
  }),
  component: AssetsPage,
})

function AssetsPage() {
  const { imageId } = Route.useSearch()
  return <UserImagesDisplay deepLinkImageId={imageId} />
}
