import { Sparkles } from 'lucide-react'
import type {
  StoryboardTab,
  UseStoryboardPageReturn,
} from '../hooks/useStoryboardPage'
import { ActionButton } from '@/components/ActionButton'

const tabs: Array<{ value: StoryboardTab; label: string }> = [
  { value: 'story', label: 'Story' },
  { value: 'elements', label: 'Elements' },
  { value: 'scenes', label: 'Scenes' },
]

interface StoryboardTabsProps {
  page: UseStoryboardPageReturn
}

export function StoryboardTabs({ page }: StoryboardTabsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const disabled =
            (t.value === 'elements' && !page.hasElements) ||
            (t.value === 'scenes' && !page.hasScenes)

          return (
            <button
              key={t.value}
              type="button"
              onClick={() => page.setTab(t.value)}
              disabled={disabled}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                page.tab === t.value
                  ? 'bg-primary text-primary-foreground'
                  : disabled
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <ActionButton
        onClick={page.generateReferences}
        disabled={!page.story.trim()}
        loading={page.isGenerating}
        loadingText="Extracting..."
        icon={<Sparkles className="size-4" />}
      >
        Extract Elements
      </ActionButton>
    </div>
  )
}
