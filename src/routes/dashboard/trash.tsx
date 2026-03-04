import { createFileRoute } from '@tanstack/react-router'
import { TrashDisplay } from '@/features/trash'

export const Route = createFileRoute('/dashboard/trash')({
  component: TrashPage,
})

function TrashPage() {
  return <TrashDisplay />
}
