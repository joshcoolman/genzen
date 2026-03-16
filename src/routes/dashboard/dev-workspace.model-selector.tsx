import { createFileRoute } from '@tanstack/react-router'
import { DevWorkspacePage } from '@/features/dev-workspace'

export const Route = createFileRoute('/dashboard/dev-workspace/model-selector')(
  {
    component: DevWorkspacePage,
  },
)
