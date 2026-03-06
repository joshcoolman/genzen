import { OutpaintCard } from './OutpaintCard'
import type { UseOutpaintPageReturn } from '../hooks/useOutpaintPage'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'

interface OutpaintPageContentProps {
  page: UseOutpaintPageReturn
}

export function OutpaintPageContent({ page }: OutpaintPageContentProps) {
  return (
    <div className="space-y-6">
      <OutpaintCard page={page} />
      <GenerationResultsGrid
        results={page.recentResults}
        onDelete={page.deleteResult}
      />
    </div>
  )
}
