import { z } from 'zod'
import { buildPublicUrl, waitForGeneration } from '../wait-for-generation'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { generateImageInternal } from '@/features/ai-images/server/generate-image-internal.server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'

const inputSchema = {
  prompt: z
    .string()
    .min(1)
    .describe('What to generate. Plain natural language, no special syntax.'),
  modelId: z
    .string()
    .min(1)
    .describe(
      'Model id from list_image_models (e.g. fal-ai/flux/schnell). Picks the engine.',
    ),
  aspectRatio: z
    .string()
    .optional()
    .describe(
      'Optional ratio like "1:1", "16:9", "9:16", "4:3". Defaults to model default.',
    ),
  sourceImageId: z
    .uuid()
    .optional()
    .describe(
      "Optional imageId to use as a starting point (from upload_image or list_recent_generations). The model auto-switches to its image-input variant if available. Cannot be combined with text-only generation models that don't accept image input.",
    ),
  referenceImageIds: z
    .array(z.uuid())
    .max(10)
    .optional()
    .describe(
      'Optional list of imageIds to use as visual references (for compatible models). Up to 10.',
    ),
}

async function resolveSourceImageUrl(
  userId: string,
  sourceImageId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('user_images')
    .select('storage_path')
    .eq('id', sourceImageId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Source image lookup failed: ${error.message}`)
  if (!data?.storage_path) {
    throw new Error(`Source image ${sourceImageId} not found`)
  }
  const url = buildPublicUrl(data.storage_path)
  if (!url) {
    throw new Error('R2 public URL is not configured on the server')
  }
  return url
}

export function registerGenerateImage(server: McpServer, userId: string): void {
  server.registerTool(
    'generate_image',
    {
      title: 'Generate an image',
      description:
        "Generates a new image and saves it to the user's Genzen library. Blocks until the FAL job completes (typically 5–15s, up to 90s timeout). Returns the imageId, public URL, the model that ran, and the provider cost in cents when available.",
      inputSchema,
    },
    async ({
      prompt,
      modelId,
      aspectRatio,
      sourceImageId,
      referenceImageIds,
    }) => {
      const sourceImageUrl = sourceImageId
        ? await resolveSourceImageUrl(userId, sourceImageId)
        : undefined

      const submission = await generateImageInternal({
        userId,
        sourceClient: 'mcp',
        prompt,
        model: modelId,
        aspectRatio,
        sourceImageUrl,
        referenceImageIds,
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
