import { useMemo } from 'react'
import type { GeneratorState } from './use-generator'
import { useRegisterADContext } from '@/features/ad/context/ad-context'
import { getModelName } from '@/features/ai-images/models'

interface AiImagesADContextInput {
  generator: GeneratorState
  credits: { balance: number | null }
  completedImages: Array<unknown>
  error: string | null
}

export function useAiImagesADContext(page: AiImagesADContextInput) {
  const summary = useMemo(() => {
    const parts: Array<string> = []
    parts.push('Current AI Images state:')

    if (page.generator.prompt) {
      const truncated =
        page.generator.prompt.length > 200
          ? page.generator.prompt.slice(0, 200) + '...'
          : page.generator.prompt
      parts.push(`- Current prompt: "${truncated}"`)
    }

    const modelNames = page.generator.activeModels.map(getModelName)
    if (modelNames.length > 0) {
      parts.push(`- Selected models: ${modelNames.join(', ')}`)
    }

    parts.push(
      `- Aspect ratio: ${page.generator.aspectRatio} (${page.generator.orientation})`,
    )
    parts.push(`- Input mode: ${page.generator.inputMode}`)

    if (page.generator.loading) {
      parts.push('- Currently generating images')
    }

    if (page.credits.balance !== null) {
      parts.push(`- Credits remaining: ${page.credits.balance}`)
    }

    parts.push(`- ${page.completedImages.length} images in gallery`)

    if (page.error) {
      parts.push(`- Error: ${page.error}`)
    }

    return parts.join('\n')
  }, [
    page.generator.prompt,
    page.generator.activeModels,
    page.generator.aspectRatio,
    page.generator.orientation,
    page.generator.inputMode,
    page.generator.loading,
    page.credits.balance,
    page.completedImages.length,
    page.error,
  ])

  useRegisterADContext('ai-images', summary)
}
