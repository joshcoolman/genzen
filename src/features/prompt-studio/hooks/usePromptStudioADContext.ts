import { useMemo } from 'react'
import type { UsePromptStudioReturn } from './usePromptStudio'
import { useRegisterADContext } from '@/features/ad/context/ad-context'

export function usePromptStudioADContext(studio: UsePromptStudioReturn) {
  const summary = useMemo(() => {
    const parts: Array<string> = []
    parts.push('Current Prompt Studio state:')

    if (studio.prompt) {
      const truncated =
        studio.prompt.length > 200
          ? studio.prompt.slice(0, 200) + '...'
          : studio.prompt
      parts.push(`- Current prompt: "${truncated}"`)
    }

    const modelNames = studio.selectedModelIds
      .map(
        (id) => studio.enabledTextModels.find((m) => m.id === id)?.name ?? id,
      )
      .join(', ')
    parts.push(`- Selected models: ${modelNames}`)

    if (studio.activeSetId) {
      const set = studio.promptSets.getSet(studio.activeSetId)
      if (set) {
        parts.push(
          `- Active set: "${set.name}"${studio.isDirty ? ' (modified)' : ''}`,
        )
      }
    }

    parts.push(`- ${studio.results.length} results`)

    if (studio.running) {
      parts.push('- Currently running')
    }

    return parts.join('\n')
  }, [
    studio.prompt,
    studio.selectedModelIds,
    studio.enabledTextModels,
    studio.activeSetId,
    studio.isDirty,
    studio.promptSets,
    studio.results.length,
    studio.running,
  ])

  useRegisterADContext('prompt-studio', summary)
}
