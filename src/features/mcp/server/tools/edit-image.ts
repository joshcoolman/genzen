import { z } from 'zod'
import { buildPublicUrl, waitForGeneration } from '../wait-for-generation'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { editImageInternal } from '@/features/ai-images/server/edit-image-internal.server'
import { EDIT_MODELS } from '@/features/ai-images/models'

const inputSchema = {
  sourceImageId: z
    .uuid()
    .describe(
      'imageId of the image to edit (from upload_image, list_recent_generations, or a previous generate_image call).',
    ),
  editPrompt: z
    .string()
    .min(1)
    .describe(
      'Natural-language description of the change to apply to the source image.',
    ),
  editModelId: z
    .string()
    .optional()
    .describe(
      'Optional edit model id from list_edit_models. Defaults to fal-ai/gpt-image-1.5/edit. Different models accept different numbers of reference images — see list_edit_models.',
    ),
  referenceImageIds: z
    .array(z.uuid())
    .max(10)
    .optional()
    .describe(
      'Optional list of imageIds to attach as visual references. The model fuses style/subject from these. Max varies by model (list_edit_models shows maxRefImages).',
    ),
  aspectRatio: z
    .string()
    .optional()
    .describe('Optional ratio like "1:1", "16:9". Defaults to model default.'),
}

const DEFAULT_EDIT_MODEL = 'fal-ai/gpt-image-1.5/edit'

export function registerEditImage(server: McpServer, userId: string): void {
  server.registerTool(
    'edit_image',
    {
      title: 'Edit an image',
      description:
        "Edits an existing image in the user's Genzen library, optionally fusing in reference images for multi-ref edits like 'put person A and person B together in a group photo'. Blocks until the FAL job completes (up to 90s timeout). Returns the new imageId and URL.",
      inputSchema,
    },
    async ({
      sourceImageId,
      editPrompt,
      editModelId,
      referenceImageIds,
      aspectRatio,
    }) => {
      const modelId = editModelId ?? DEFAULT_EDIT_MODEL
      const model = EDIT_MODELS.find((m) => m.id === modelId)
      if (!model) {
        throw new Error(
          `Unknown edit model: ${modelId}. Call list_edit_models to see options.`,
        )
      }
      const refCount = referenceImageIds?.length ?? 0
      if (refCount > model.maxRefImages) {
        throw new Error(
          `${model.name} accepts at most ${model.maxRefImages} reference images, got ${refCount}. Use list_edit_models to find a model with a higher maxRefImages.`,
        )
      }

      const submission = await editImageInternal({
        userId,
        sourceClient: 'mcp',
        sourceImageId,
        editPrompt,
        editModelId: modelId,
        referenceImageIds,
        aspectRatio,
      })

      const completed = await waitForGeneration(userId, submission.recordId)
      const meta = completed.generation_metadata ?? {}
      const providerCostCents =
        typeof meta.provider_cost_cents === 'number'
          ? meta.provider_cost_cents
          : null
      const result = {
        imageId: completed.id,
        url: buildPublicUrl(completed.storage_path),
        model: modelId,
        title: completed.title,
        providerCostCents,
      }
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      }
    },
  )
}
