import { createFileRoute } from '@tanstack/react-router'
import { PromptStudioContent, usePromptStudio } from '@/features/prompt-studio'

export const Route = createFileRoute('/dashboard/dev-workspace/prompt-studio')({
  component: PromptStudioPage,
})

function PromptStudioPage() {
  const studio = usePromptStudio()
  return <PromptStudioContent studio={studio} />
}
