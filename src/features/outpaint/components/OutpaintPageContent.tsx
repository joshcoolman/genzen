import { OutpaintCard } from './OutpaintCard'
import type { UseOutpaintPageReturn } from '../hooks/useOutpaintPage'

interface OutpaintPageContentProps {
  page: UseOutpaintPageReturn
}

export function OutpaintPageContent({ page }: OutpaintPageContentProps) {
  return (
    <div className="space-y-6">
      <OutpaintCard page={page} />
    </div>
  )
}
