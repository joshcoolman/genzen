import { createFileRoute } from '@tanstack/react-router'
import { MultiModelPage, useMultiModel } from '@/features/multi-model'

export const Route = createFileRoute('/dashboard/dev-workspace/multi-model')({
  component: MultiModelRoute,
})

function MultiModelRoute() {
  const state = useMultiModel()
  return <MultiModelPage state={state} />
}
