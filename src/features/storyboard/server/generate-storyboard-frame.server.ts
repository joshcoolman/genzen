import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import {
  ALL_IMAGE_MODELS,
  STORYBOARD_FRAME_MODEL,
} from '@/features/ai-images/models'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { fetchAndUploadToFal } from '@/lib/server/fal-image-upload.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateStoryboardFrameInput {
  visualDescription: string
  framing?: string
  camera?: string
  lighting?: string
  lens?: string
  angle?: string
  sceneId: string
  storyboardId: string
  accessToken: string
  characterImageUrls?: Array<string>
}

export const generateStoryboardFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateStoryboardFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!data.visualDescription.trim()) {
      throw new Error('Visual description is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(
      data.accessToken,
      'image_gen',
    )
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    const baseModelId = STORYBOARD_FRAME_MODEL

    // Build enriched prompt with cinematography metadata
    const cineParts: Array<string> = []
    if (data.framing) cineParts.push(`${data.framing} shot`)
    if (data.angle && data.angle !== 'eye level') cineParts.push(data.angle)
    if (data.lens) cineParts.push(`shot on ${data.lens}`)
    if (data.lighting) cineParts.push(data.lighting)
    const cinePrefix = cineParts.length > 0 ? cineParts.join(', ') + '. ' : ''
    const prompt = `${cinePrefix}${data.visualDescription.trim()}`

    const hasImages =
      data.characterImageUrls && data.characterImageUrls.length > 0

    // Use the edit endpoint when reference images are provided
    const modelDef = ALL_IMAGE_MODELS.find((m) => m.id === baseModelId)
    const modelId =
      hasImages && modelDef?.imageInputModelId
        ? modelDef.imageInputModelId
        : baseModelId

    // Re-upload images to FAL storage (Supabase signed URLs aren't publicly accessible)
    let falImageUrls: Array<string> | undefined
    if (hasImages) {
      falImageUrls = await Promise.all(
        data.characterImageUrls!.map(fetchAndUploadToFal),
      )
    }

    const falInput = await buildFalInput({
      modelId,
      prompt,
      aspectRatio: '16:9',
      safetyLevel: 'permissive',
      imageUrls: falImageUrls,
    })

    const { request_id } = await (fal.queue.submit as any)(modelId, {
      input: falInput,
    })

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_generated',
        title: 'Storyboard Frame',
        sort_order: Date.now() / 1000,
        generation_metadata: {
          prompt,
          model: baseModelId,
          fal_model_id: modelId,
          generation_type: 'storyboard_frame',
          storyboard_id: data.storyboardId,
          scene_id: data.sceneId,
          submitted_at: new Date().toISOString(),
          aspect_ratio: '16:9',
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create image record: ${insertError.message}`)
    }

    return { recordId: record.id, request_id, sceneId: data.sceneId }
  })
