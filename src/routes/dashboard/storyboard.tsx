import { createFileRoute } from '@tanstack/react-router'
import { StoryboardPage, useStoryboard } from '@/features/storyboard'

export const Route = createFileRoute('/dashboard/storyboard')({
  component: StoryboardRoute,
})

function StoryboardRoute() {
  const sb = useStoryboard()
  return <StoryboardPage sb={sb} />
}
