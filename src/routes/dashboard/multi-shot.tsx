import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/multi-shot')({
  component: MultiShotLayout,
})

function MultiShotLayout() {
  return <Outlet />
}
