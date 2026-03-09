import { StoryInput } from './StoryInput'
import { ReferenceBoard } from './ReferenceBoard'
import { SceneList } from './SceneList'
import { StoryboardTabs } from './StoryboardTabs'
import type { UseStoryboardPageReturn } from '../hooks/useStoryboardPage'

interface StoryboardPageContentProps {
  page: UseStoryboardPageReturn
}

export function StoryboardPageContent({ page }: StoryboardPageContentProps) {
  return (
    <div className="space-y-6">
      <StoryboardTabs page={page} />
      {page.tab === 'story' && <StoryInput page={page} />}
      {page.tab === 'elements' && <ReferenceBoard page={page} />}
      {page.tab === 'scenes' && <SceneList page={page} />}
    </div>
  )
}
