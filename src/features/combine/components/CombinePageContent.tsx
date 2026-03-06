import { CombineCard } from './CombineCard'
import type { UseCombinePageReturn } from '../hooks/useCombinePage'

interface CombinePageContentProps {
  page: UseCombinePageReturn
}

export function CombinePageContent({ page }: CombinePageContentProps) {
  return (
    <div className="space-y-6">
      <CombineCard page={page} />
    </div>
  )
}
