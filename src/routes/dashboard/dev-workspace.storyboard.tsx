import { createFileRoute } from '@tanstack/react-router'
import { StoryboardPage, useStoryboard } from '@/features/storyboard'
import { useStoryboardADContext } from '@/features/storyboard/hooks/useStoryboardADContext'

export const Route = createFileRoute('/dashboard/dev-workspace/storyboard')({
  component: StoryboardRoute,
})

function StoryboardRoute() {
  const sb = useStoryboard()
  useStoryboardADContext(sb)
  return <StoryboardPage sb={sb} />
}
