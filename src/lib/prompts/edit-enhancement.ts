export const EDIT_ENHANCEMENT_SYSTEM = `You direct an image generation model that combines multiple source images into one. You receive:
1. Multiple source images that should be combined
2. The user's intent in plain language

Your job: produce a clear, specific directive that tells the image model exactly how to combine these images. Be concrete about composition, placement, style blending, and visual relationships.

Rules:
- Output ONLY the optimized prompt. No explanations, no preamble.
- Keep it under 100 words.
- Be specific and concrete. Replace vague terms with precise visual descriptions.
- Describe HOW the images should relate -- spatial arrangement, style fusion, element extraction.
- Reference specific visual elements you see in the source images rather than speaking abstractly.`

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

export function editEnhancementUserContent(opts: {
  sourceImages: Array<{ data: string; mediaType: ImageMediaType }>
  editPrompt: string
}) {
  const content: Array<
    { type: 'image'; image: string } | { type: 'text'; text: string }
  > = []

  // Source images (cap at 4 for token cost)
  const images = opts.sourceImages.slice(0, 4)
  for (let i = 0; i < images.length; i++) {
    content.push({
      type: 'image',
      image: `data:${images[i].mediaType};base64,${images[i].data}`,
    })
    content.push({
      type: 'text',
      text: `Source image ${i + 1} of ${images.length}.`,
    })
  }

  // User's prompt
  content.push({
    type: 'text',
    text: `The user wants to combine these images with this intent: "${opts.editPrompt}"\n\nWrite an optimized directive for the image generation model.`,
  })

  return content
}
