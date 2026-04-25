import { createFileRoute } from '@tanstack/react-router'
import { ActivityPage } from '@/features/activity/components/ActivityPage'

export const Route = createFileRoute('/dashboard/activity')({
  component: ActivityRoute,
})

function ActivityRoute() {
  return <ActivityPage />
}
