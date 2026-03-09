import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { buildFalInput } from '@/features/ai-images/server/fal-params.server'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateStoryFrameInput {
  story: string
  accessToken: string
  imageIds: Array<string>
  modelId?: string
}

function buildStoryFramePrompt(story: string): string {
  const trimmed = story.trim().slice(0, 800)
  return `Create a stunning, cinematic key frame for this story. The reference images show visual directions the user has explored and generally likes -- use them as loose inspiration for mood, palette, and atmosphere, but feel free to expand, enhance, and elevate beyond them. Your goal is to produce a single compelling image that captures the emotional core of the story and delights the viewer. Be bold and creative.

Story: ${trimmed}`
}

export const generateStoryFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateStoryFrameInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!data.story.trim()) {
      throw new Error('Story text is required')
    }

    if (!data.imageIds.length) {
      throw new Error('At least one reference image is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(data.accessToken, 'edit')
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    const modelId = data.modelId || 'fal-ai/nano-banana-2/edit'

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch the specific images by ID
    const { data: refImages } = await supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', data.imageIds)
      .eq('user_id', user.id)

    const validImages = (refImages ?? []).filter((f) => f.storage_path)

    if (validImages.length === 0) {
      throw new Error('No valid reference images found')
    }

    // Upload reference images to FAL storage
    const imageUrls = await Promise.all(
      validImages.map(async (img) => {
        const { data: signed } = await supabase.storage
          .from('user-images')
          .createSignedUrl(img.storage_path, 3600)
        if (!signed?.signedUrl) {
          throw new Error('Failed to get signed URL for reference image')
        }
        const res = await fetch(signed.signedUrl)
        const buf = await res.arrayBuffer()
        return fal.storage.upload(new Blob([buf]))
      }),
    )

    const prompt = buildStoryFramePrompt(data.story)

    const falInput = await buildFalInput({
      modelId,
      prompt,
      aspectRatio: '16:9',
      imageUrls,
      safetyLevel: 'permissive',
    })

    const { request_id } = await (fal.queue.submit as any)(modelId, {
      input: falInput,
    })

    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_generated',
        title: 'Story Frame',
        sort_order: Date.now() / 1000,
        generation_metadata: {
          prompt,
          model: modelId.replace(/\/edit$/, ''),
          fal_model_id: modelId,
          generation_type: 'story_frame',
          submitted_at: new Date().toISOString(),
          aspect_ratio: '16:9',
          reference_image_ids: data.imageIds,
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create image record: ${insertError.message}`)
    }

    return { recordId: record.id, request_id }
  })
