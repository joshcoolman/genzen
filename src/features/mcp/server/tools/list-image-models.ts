import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'

export function registerListImageModels(server: McpServer): void {
  server.registerTool(
    'list_image_models',
    {
      title: 'List image generation models',
      description:
        "Returns the catalog of image generation models available in the user's Genzen account, including each model's id, display name, description, category, provider, and whether it accepts an input image.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => {
      const models = ALL_IMAGE_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        category: m.category,
        provider: m.provider ?? 'fal',
        supportsImageInput: m.supportsImageInput ?? false,
        imageInputModelId: m.imageInputModelId,
      }))
      return Promise.resolve({
        content: [
          { type: 'text' as const, text: JSON.stringify(models, null, 2) },
        ],
      })
    },
  )
}
