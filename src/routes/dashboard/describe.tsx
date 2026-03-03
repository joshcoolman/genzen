import { createFileRoute } from '@tanstack/react-router'
import { DescribePageContent, useDescribePage } from '@/features/describe'

export const Route = createFileRoute('/dashboard/describe')({
  component: DescribePage,
})

function DescribePage() {
  const page = useDescribePage()
  return <DescribePageContent page={page} />
}
