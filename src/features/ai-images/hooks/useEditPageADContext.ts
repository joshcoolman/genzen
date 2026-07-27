import { useMemo } from 'react'
import type { ADContextImage } from '#/features/ad/context/ad-context'
import {
  useRegisterADContext,
  useRegisterADImage,
} from '#/features/ad/context/ad-context'
import { getModelName } from '#/features/ai-images/models'

interface EditPageADContextInput {
  sourceImageMeta: {
    id: string
    title: string | null
    prompt: string | null
    aspectRatio: string | null
    generationMetadata: Record<string, unknown> | null
  } | null
  generator: {
    sourceImage: { base64: string; name: string } | null
    prompt: string
    aspectRatio: string
    orientation: string
    loading: boolean
  }
  modelSelector: { selectedIds: Array<string> }
  chainImageCount: number
  activeSourceId: string | null
  isChained: boolean
}

export function useEditPageADContext(page: EditPageADContextInput) {
  // Text context: metadata about what the user is editing
  const summary = useMemo(() => {
    const parts: Array<string> = []
    parts.push('Current Edit page state:')

    if (page.sourceImageMeta) {
      if (page.sourceImageMeta.title) {
        parts.push(`- Editing image: "${page.sourceImageMeta.title}"`)
      }
      if (page.sourceImageMeta.prompt) {
        const truncated =
          page.sourceImageMeta.prompt.length > 200
            ? page.sourceImageMeta.prompt.slice(0, 200) + '...'
            : page.sourceImageMeta.prompt
        parts.push(`- Original generation prompt: "${truncated}"`)
      }
      if (page.sourceImageMeta.aspectRatio) {
        parts.push(`- Aspect ratio: ${page.sourceImageMeta.aspectRatio}`)
      }
      const model = page.sourceImageMeta.generationMetadata?.model_id as
        | string
        | undefined
      if (model) {
        parts.push(`- Generated with: ${getModelName(model)}`)
      }
    }

    if (page.generator.prompt) {
      const truncated =
        page.generator.prompt.length > 200
          ? page.generator.prompt.slice(0, 200) + '...'
          : page.generator.prompt
      parts.push(`- Current edit prompt: "${truncated}"`)
    }

    const modelNames = page.modelSelector.selectedIds
      .map(getModelName)
      .join(', ')
    parts.push(`- Edit model(s): ${modelNames}`)

    parts.push(`- ${page.chainImageCount} images in edit chain`)

    if (page.isChained) {
      parts.push('- Editing a child image (not the original)')
    }

    if (page.generator.loading) {
      parts.push('- Currently generating')
    }

    parts.push(
      '\nThe user is viewing this image right now. It has been included as a vision block so you can see it directly.',
    )

    return parts.join('\n')
  }, [
    page.sourceImageMeta,
    page.generator.prompt,
    page.generator.loading,
    page.modelSelector.selectedIds,
    page.chainImageCount,
    page.isChained,
  ])

  useRegisterADContext('edit-page', summary)

  // Image context: the actual image the user is looking at
  const contextImage = useMemo((): ADContextImage | null => {
    const base64DataUrl = page.generator.sourceImage?.base64
    if (!base64DataUrl) return null

    // Strip the data URL prefix: "data:image/png;base64,..." -> raw base64
    const match = base64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (!match) return null

    return {
      mediaType: match[1],
      base64: match[2],
    }
  }, [page.generator.sourceImage?.base64])

  useRegisterADImage('edit-page', contextImage)
}
