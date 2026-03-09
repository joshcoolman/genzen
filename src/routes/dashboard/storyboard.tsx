import { createFileRoute } from '@tanstack/react-router'
import { StoryboardPageContent, useStoryboardPage } from '@/features/storyboard'

export const Route = createFileRoute('/dashboard/storyboard')({
  component: StoryboardPage,
})

function StoryboardPage() {
  const page = useStoryboardPage()
  return <StoryboardPageContent page={page} />
}
