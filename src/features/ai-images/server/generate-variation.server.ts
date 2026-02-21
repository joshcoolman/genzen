import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { createClient } from '@supabase/supabase-js'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateVariationInput {
  accessToken: string
  sourceImageUrl: string
  prompt: string
  sourceImageId: string
}

export const generateVariation = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateVariationInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { sourceImageUrl, prompt, sourceImageId } = data

    if (!sourceImageUrl) {
      throw new Error('Source image URL is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    // Fetch the image server-side (works with localhost Supabase)
    // then upload to FAL storage so FAL servers can access it
    const imageResponse = await fetch(sourceImageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch source image: ${imageResponse.statusText}`)
    }
    const imageBlob = new Blob([await imageResponse.arrayBuffer()], {
      type: imageResponse.headers.get('content-type') ?? 'image/png',
    })
    const falImageUrl = await fal.storage.upload(
      new File([imageBlob], 'source.png', { type: imageBlob.type }),
    )

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch the source image's created_at so variations sort next to it
    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('created_at')
      .eq('id', sourceImageId)
      .single()

    const model = 'fal-ai/flux/dev/image-to-image'
    const results: { recordId: string; request_id: string }[] = []

    for (let i = 0; i < 2; i++) {
      const { request_id } = await fal.queue.submit(model, {
        input: {
          image_url: falImageUrl,
          prompt,
          strength: 0.7,
        },
      })

      // Offset created_at by 1-2 seconds after source so variations sort right next to it
      const variationTimestamp = sourceImage?.created_at
        ? new Date(new Date(sourceImage.created_at).getTime() + (i + 1) * 1000).toISOString()
        : undefined

      const { data: record, error: insertError } = await supabase
        .from('user_images')
        .insert({
          user_id: user.id,
          request_id,
          status: 'pending',
          source: 'ai_generated',
          title: 'Generating variation...',
          ...(variationTimestamp && { created_at: variationTimestamp }),
          generation_metadata: {
            prompt,
            model,
            generation_type: 'img2img',
            source_image_id: sourceImageId,
            strength: 0.7,
            submitted_at: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create image record: ${insertError.message}`)
      }

      results.push({ recordId: record.id, request_id })
    }

    return results
  })
