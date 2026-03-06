import { ImageDescriberCard } from './ImageDescriberCard'
import type { UseDescribePageReturn } from '../hooks/useDescribePage'

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
    </div>
  )
}
