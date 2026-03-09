import { Sparkles } from 'lucide-react'
import { ReferenceCard } from './ReferenceCard'
import type {
  ReferenceCategory,
  UseStoryboardPageReturn,
} from '../hooks/useStoryboardPage'
import { ActionButton } from '@/components/ActionButton'

interface ReferenceBoardProps {
  page: UseStoryboardPageReturn
}

const CATEGORY_LABELS: Record<ReferenceCategory, string> = {
  character: 'Characters',
  object: 'Objects',
  environment: 'Environments',
}

const CATEGORY_ORDER: Array<ReferenceCategory> = [
  'character',
  'object',
  'environment',
]

export function ReferenceBoard({ page }: ReferenceBoardProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionButton
          onClick={page.generateScenes}
          disabled={!page.canProceedToScenes}
          loading={page.isGenerating}
          loadingText="Breaking into scenes..."
          icon={<Sparkles className="size-4" />}
        >
          Generate Scenes
        </ActionButton>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-2/3 space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const items = page.references.filter((r) => r.category === category)
            if (items.length === 0) return null
            return (
              <section key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {items.map((ref) => (
                    <ReferenceCard
                      key={ref.id}
                      reference={ref}
                      onRemove={() => page.removeReference(ref.id)}
                      onEdit={(instruction) =>
                        page.editReference(ref.id, instruction)
                      }
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
