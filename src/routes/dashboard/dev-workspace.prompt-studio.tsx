import { createFileRoute } from '@tanstack/react-router'
import { PromptStudioContent, usePromptStudio } from '@/features/prompt-studio'
import { usePromptStudioADContext } from '@/features/prompt-studio/hooks/usePromptStudioADContext'

export const Route = createFileRoute('/dashboard/dev-workspace/prompt-studio')({
  component: PromptStudioPage,
})

function PromptStudioPage() {
  const studio = usePromptStudio()
  usePromptStudioADContext(studio)
  return <PromptStudioContent studio={studio} />
}
