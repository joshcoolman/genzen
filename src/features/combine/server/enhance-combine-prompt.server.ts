import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'
import {
  EDIT_ENHANCEMENT_SYSTEM,
  editEnhancementUserContent,
} from '@/lib/prompts'

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

interface EnhanceCombinePromptInput {
  accessToken: string
  sourceImageUrls: Array<string>
  prompt: string
}

function detectMediaType(bytes: Uint8Array): ImageMediaType {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  return 'image/jpeg'
}

function parseDataUrl(dataUrl: string): {
  data: string
  mediaType: ImageMediaType
} | null {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) return null
  return {
    mediaType: match[1] as ImageMediaType,
    data: match[2],
  }
}

async function fetchImageBase64(
  url: string,
): Promise<{ data: string; mediaType: ImageMediaType } | null> {
  try {
    // Handle data URLs directly
    if (url.startsWith('data:')) {
      return parseDataUrl(url)
    }

    const res = await fetch(url)
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    return {
      data: Buffer.from(buffer).toString('base64'),
      mediaType: detectMediaType(bytes),
    }
  } catch {
    return null
  }
}

export const enhanceCombinePrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: EnhanceCombinePromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    // Fetch up to 4 source images for vision
    const imageResults = await Promise.all(
      data.sourceImageUrls.slice(0, 4).map(fetchImageBase64),
    )
    const sourceImages = imageResults.filter(
      (r): r is { data: string; mediaType: ImageMediaType } => r !== null,
    )

    if (sourceImages.length === 0) {
      throw new Error('Could not fetch any source images')
    }

    const response = await generateText({
      model: ai.reasoning,
      maxOutputTokens: 400,
      system: EDIT_ENHANCEMENT_SYSTEM,
      messages: [
        {
          role: 'user',
          content: editEnhancementUserContent({
            sourceImages,
            editPrompt: data.prompt,
          }),
        },
      ],
    })

    return {
      enhancedPrompt: response.text.trim(),
      originalPrompt: data.prompt,
    }
  })
