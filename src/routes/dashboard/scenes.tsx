import { createFileRoute } from '@tanstack/react-router'
import { ScenesPage, useScenes } from '@/features/scenes'

export const Route = createFileRoute('/dashboard/scenes')({
  component: ScenesRoute,
})

function ScenesRoute() {
  const state = useScenes()
  return <ScenesPage state={state} />
}
