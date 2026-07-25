import { useMemo } from 'react'
import type { GeneratorState } from './use-generator'
import { useRegisterADContext } from '@/features/ad/context/ad-context'
import { getModelName } from '@/features/ai-images/models'

interface AiImagesADContextInput {
  generator: GeneratorState
  modelSelector: { selectedIds: Array<string> }
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

    const modelNames = page.modelSelector.selectedIds
      .map(getModelName)
      .join(', ')
    parts.push(`- Active model(s): ${modelNames}`)

    parts.push(
      `- Aspect ratio: ${page.generator.aspectRatio} (${page.generator.orientation})`,
    )

    if (page.generator.sourceImage) {
      parts.push('- Source image attached')
    }

    if (page.generator.loading) {
      parts.push('- Currently generating images')
    }

    parts.push(`- ${page.completedImages.length} images in gallery`)

    if (page.error) {
      parts.push(`- Error: ${page.error}`)
    }

    return parts.join('\n')
  }, [
    page.generator.prompt,
    page.modelSelector.selectedIds,
    page.generator.aspectRatio,
    page.generator.orientation,
    page.generator.sourceImage,
    page.generator.loading,
    page.completedImages.length,
    page.error,
  ])

  useRegisterADContext('ai-images', summary)
}
