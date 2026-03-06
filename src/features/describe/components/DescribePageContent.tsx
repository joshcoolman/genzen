import { ImageDescriberCard } from './ImageDescriberCard'
import type { UseDescribePageReturn } from '../hooks/useDescribePage'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'

interface DescribePageContentProps {
  page: UseDescribePageReturn
}

export function DescribePageContent({ page }: DescribePageContentProps) {
  return (
    <div className="space-y-6">
      <ImageDescriberCard
        describer={page.describer}
        existingImages={page.existingImages}
      />
      <GenerationResultsGrid
        results={page.describer.recentResults}
        onDelete={page.describer.deleteResult}
      />
    </div>
  )
}
