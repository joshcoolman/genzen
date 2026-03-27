import { createFileRoute } from '@tanstack/react-router'
import { InfiniteCanvas } from '@/features/canvas'

export const Route = createFileRoute('/dashboard/canvas')({
  component: CanvasPage,
})

function CanvasPage() {
  return <InfiniteCanvas />
}
