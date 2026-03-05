import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { checkAndDeductCredits } from '@/features/credits/server/check-credits.server'
import { RATIO_TO_SIZE } from '@/features/ai-images/constants'
import { EDIT_MODELS } from '@/features/ai-images/models'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface EditImageInput {
  accessToken: string
  sourceImageId: string
  editPrompt: string
  aspectRatio?: string
  editModelId?: string
  referenceImageIds?: Array<string>
  numImages?: number
}

export const editImage = createServerFn({ method: 'POST' })
  .inputValidator((data: EditImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const {
      sourceImageId,
      editPrompt,
      aspectRatio,
      editModelId,
      referenceImageIds,
      numImages,
    } = data
    const falEditModel = editModelId || 'fal-ai/gpt-image-1.5/edit'
    const numImagesToGenerate = Math.min(Math.max(numImages ?? 1, 1), 3)
    const modelDef = EDIT_MODELS.find((m) => m.id === falEditModel)
    const sizeParam = modelDef?.sizeParam ?? 'image_size'

    if (!editPrompt.trim()) {
      throw new Error('Edit prompt is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const creditResult = await checkAndDeductCredits(data.accessToken, 'edit')
    if (!creditResult.allowed) {
      throw new Error('Insufficient credits')
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch source image storage path — enforce ownership
    const { data: sourceImage } = await supabase
      .from('user_images')
      .select('storage_path, created_at, generation_metadata')
      .eq('id', sourceImageId)
      .eq('user_id', user.id)
      .single()

    if (!sourceImage?.storage_path) {
      throw new Error('Source image not found')
    }

    // Get signed URL and fetch image bytes
    const { data: signedUrlData } = await supabase.storage
      .from('user-images')
      .createSignedUrl(sourceImage.storage_path, 3600)

    if (!signedUrlData?.signedUrl) {
      throw new Error('Failed to get signed URL for source image')
    }

    const imageRes = await fetch(signedUrlData.signedUrl)
    const buffer = await imageRes.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Detect mime type from magic bytes
    let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
      'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      mimeType = 'image/png'
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49) {
      mimeType = 'image/webp'
    } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
      mimeType = 'image/gif'
    }

    // Upload to FAL storage
    const falImageUrl = await fal.storage.upload(
      new Blob([buffer], { type: mimeType }),
    )

    // Fetch and upload reference images in parallel
    const referenceUrls: Array<string> = []
    if (referenceImageIds?.length) {
      const refImages = await supabase
        .from('user_images')
        .select('id, storage_path')
        .in('id', referenceImageIds)
        .eq('user_id', user.id)

      if (refImages.data?.length) {
        const uploads = await Promise.all(
          refImages.data.map(async (ref) => {
            if (!ref.storage_path) return null
            const { data: signed } = await supabase.storage
              .from('user-images')
              .createSignedUrl(ref.storage_path, 3600)
            if (!signed?.signedUrl) return null
            const res = await fetch(signed.signedUrl)
            const buf = await res.arrayBuffer()
            return fal.storage.upload(new Blob([buf]))
          }),
        )
        referenceUrls.push(...uploads.filter((u): u is string => u !== null))
      }
    }

    // Submit to selected edit model (dynamic ID, bypass typed overloads)
    // GPT Image 1.5 requires a string enum for image_size, not a {width,height} object
    const gptImageSizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '3:2': '1536x1024',
      '16:9': '1536x1024',
      '4:3': '1536x1024',
      '2:1': '1536x1024',
      '21:9': '1536x1024',
      '2:3': '1024x1536',
      '9:16': '1024x1536',
      '3:4': '1024x1536',
      '1:2': '1024x1536',
    }
    const sizeParams = aspectRatio
      ? sizeParam === 'aspect_ratio'
        ? { aspect_ratio: aspectRatio }
        : falEditModel === 'fal-ai/gpt-image-1.5/edit'
          ? { image_size: gptImageSizeMap[aspectRatio] ?? '1024x1024' }
          : { image_size: RATIO_TO_SIZE[aspectRatio] ?? RATIO_TO_SIZE['1:1'] }
      : {}

    const { request_id } = await (fal.queue.submit as any)(falEditModel, {
      input: {
        prompt: editPrompt.trim(),
        image_urls: [falImageUrl, ...referenceUrls],
        num_images: numImagesToGenerate,
        ...(falEditModel.includes('nano-banana')
          ? { safety_tolerance: 6 }
          : {}),
        ...sizeParams,
      },
    })

    // Create pending DB record
    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id,
        status: 'pending',
        source: 'ai_generated',
        title: 'Editing...',
        sort_order: Date.now() / 1000,
        generation_metadata: {
          prompt: editPrompt.trim(),
          model: falEditModel.replace(/\/edit$/, ''),
          fal_model_id: falEditModel,
          source_image_id: sourceImageId,
          generation_type: 'edit',
          submitted_at: new Date().toISOString(),
          ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          ...(referenceImageIds?.length
            ? { reference_image_ids: referenceImageIds }
            : {}),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create image record: ${insertError.message}`)
    }

    return { recordId: record.id, request_id }
  })
