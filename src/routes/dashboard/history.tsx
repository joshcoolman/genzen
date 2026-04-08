import { createFileRoute } from '@tanstack/react-router'
import { HistoryPage } from '@/features/history/components/HistoryPage'

export const Route = createFileRoute('/dashboard/history')({
  component: HistoryRoute,
})

function HistoryRoute() {
  return <HistoryPage />
}
