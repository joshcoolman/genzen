import { createFileRoute } from '@tanstack/react-router'
import { ShotsPageContent, useShotsPage } from '@/features/shots'

export const Route = createFileRoute('/dashboard/shots')({
  component: ShotsPage,
})

function ShotsPage() {
  const page = useShotsPage()
  return <ShotsPageContent page={page} />
}
