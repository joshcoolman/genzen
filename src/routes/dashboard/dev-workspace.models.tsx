import { createFileRoute } from '@tanstack/react-router'
import { ModelsPage } from '@/features/models'

export const Route = createFileRoute('/dashboard/dev-workspace/models')({
  component: ModelsPage,
})
