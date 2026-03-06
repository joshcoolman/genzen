import { CombineCard } from './CombineCard'
import type { UseCombinePageReturn } from '../hooks/useCombinePage'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'

interface CombinePageContentProps {
  page: UseCombinePageReturn
}

export function CombinePageContent({ page }: CombinePageContentProps) {
  return (
    <div className="space-y-6">
      <CombineCard page={page} />
      <GenerationResultsGrid
        results={page.recentResults}
        onDelete={page.deleteResult}
      />
    </div>
  )
}
