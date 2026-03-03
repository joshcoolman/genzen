import crypto from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface SaveGeneratedImageInput {
  accessToken: string
  imageUrl: string
  prompt: string
  model: string
  aspectRatio: string
}

export const saveGeneratedImage = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveGeneratedImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Download image from FAL CDN
    const imageResponse = await fetch(data.imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const imageBytes = new Uint8Array(imageBuffer)

    // Compute SHA-256 hash
    const fileHash = crypto
      .createHash('sha256')
      .update(imageBytes)
      .digest('hex')

    // Generate storage path
    const timestamp = Date.now()
    const uuid = crypto.randomUUID()
    const fileName = `ai_${timestamp}_${uuid}.png`
    const storagePath = `${user.id}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(storagePath, imageBytes, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Insert user_images row
    const truncatedPrompt =
      data.prompt.length > 997
        ? data.prompt.substring(0, 997) + '...'
        : data.prompt

    const { error: insertError } = await supabase.from('user_images').insert({
      user_id: user.id,
      status: 'completed',
      source: 'ai_generated',
      storage_path: storagePath,
      file_name: fileName,
      file_hash: fileHash,
      file_size: imageBytes.length,
      mime_type: 'image/png',
      title: data.model,
      description: truncatedPrompt,
      sort_order: Date.now() / 1000,
      generation_metadata: {
        prompt: data.prompt,
        model: data.model,
        fal_model_id: data.model,
        aspect_ratio: data.aspectRatio,
        has_source_image: true,
        completed_at: new Date().toISOString(),
      },
    })

    if (insertError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('user-images').remove([storagePath])
      throw new Error(`Insert failed: ${insertError.message}`)
    }

    return { success: true }
  })
