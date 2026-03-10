import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateStyleFrameInput {
  story: string
  accessToken: string
  modelId?: string
  element?: string
}

function buildStyleFramePrompt(story: string, element?: string): string {
  const trimmed = story.trim().slice(0, 500)
  console.log('element', element)
  console.log('trimmed', trimmed)
  if (element) {
    return `A cinematic establishing shot of ${element} from this story: ${trimmed}`
  }
  return `A cinematic establishing shot that captures the visual mood and atmosphere of this story: ${trimmed}. You are free to focus on an element or interesting aspect of the story and do not need to express the entire story in one image.`
}

export const generateStyleFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateStyleFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!data.story.trim()) {
      throw new Error('Story text is required')
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

    const modelId = data.modelId || 'fal-ai/flux/schnell'
    const prompt = buildStyleFramePrompt(data.story, data.element)

    const falInput = await buildFalInput({
      modelId,
      prompt,
      aspectRatio: '16:9',
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
        title: 'Style Frame',
        sort_order: Date.now() / 1000,
        generation_metadata: {
          prompt,
          model: modelId,
          fal_model_id: modelId,
          generation_type: 'style_frame',
          submitted_at: new Date().toISOString(),
          aspect_ratio: '16:9',
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create image record: ${insertError.message}`)
    }

    return { recordId: record.id, request_id }
  })
