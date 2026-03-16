import { createFileRoute } from '@tanstack/react-router'
import { CombinePageContent, useCombinePage } from '@/features/combine'

export const Route = createFileRoute('/dashboard/dev-workspace/combine')({
  component: CombinePage,
})

function CombinePage() {
  const page = useCombinePage()
  return <CombinePageContent page={page} />
}
