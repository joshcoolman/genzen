import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateCharacterRefInput {
  characterSlug: string
  characterDescription: string
  existingRefUrls?: Array<string>
  promptOverride?: string
  storyboardId: string
  accessToken: string
}

export const generateCharacterRef = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateCharacterRefInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!data.characterDescription.trim()) {
      throw new Error('Character description is required')
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

    const modelId = 'fal-ai/flux/schnell'
    const prompt =
      data.promptOverride?.trim() ||
      `${data.characterDescription}, character reference sheet, full body, profile view, neutral background`

    const falInput = await buildFalInput({
      modelId,
      prompt,
      aspectRatio: '1:1',
      imageUrls: data.existingRefUrls,
      safetyLevel: 'permissive',
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
        title: `Character Ref: ${data.characterSlug}`,
        sort_order: Date.now() / 1000,
        generation_metadata: {
          prompt,
          model: modelId,
          fal_model_id: modelId,
          generation_type: 'character_ref',
          storyboard_id: data.storyboardId,
          character_slug: data.characterSlug,
          submitted_at: new Date().toISOString(),
          aspect_ratio: '1:1',
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create image record: ${insertError.message}`)
    }

    return {
      recordId: record.id,
      request_id,
      characterSlug: data.characterSlug,
    }
  })
