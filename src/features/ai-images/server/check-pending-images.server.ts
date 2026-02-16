import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { requireAuth } from '@/lib/server/auth.server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface CheckPendingImagesInput {
  accessToken: string
  recordIds: string[]
}

interface CheckResult {
  recordId: string
  status: 'pending' | 'completed' | 'failed' | 'error'
  error?: string
}

export const checkPendingImages = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckPendingImagesInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    // Create Supabase client authenticated as the user
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch pending records
    const { data: pendingRecords, error: queryError } = await supabase
      .from('user_images')
      .select('*')
      .in('id', data.recordIds)
      .eq('status', 'pending')
      .eq('user_id', user.id)

    if (queryError) {
      throw new Error(`Failed to fetch pending records: ${queryError.message}`)
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return []
    }

    const results: CheckResult[] = []

    for (const record of pendingRecords) {
      const { request_id, generation_metadata } = record
      const { model, prompt } = generation_metadata as {
        model: string
        prompt: string
      }

      try {
        // Check FAL status
        const status = await fal.queue.status(model, {
          requestId: request_id,
          logs: false,
        })

        if (status.status === 'COMPLETED') {
          // Fetch result
          const result = await fal.queue.result(model, {
            requestId: request_id,
          })

          // Download image from FAL CDN
          const imageUrl = result.data.images?.[0]?.url
          if (!imageUrl) {
            throw new Error('No image URL in FAL result')
          }

          const imageResponse = await fetch(imageUrl)
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`,
            )
          }

          const imageBuffer = await imageResponse.arrayBuffer()
          const imageBytes = new Uint8Array(imageBuffer)

          // Compute SHA-256 hash
          const hashBuffer = crypto
            .createHash('sha256')
            .update(imageBytes)
            .digest('hex')

          // Generate storage path and filename
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

          // Update database record
          const { error: updateError } = await supabase
            .from('user_images')
            .update({
              status: 'completed',
              storage_path: storagePath,
              file_name: fileName,
              file_hash: hashBuffer,
              file_size: imageBytes.length,
              mime_type: 'image/png',
              title: model,
              description:
                prompt.length > 997 ? prompt.substring(0, 997) + '...' : prompt,
              generation_metadata: {
                ...generation_metadata,
                seed: result.data.seed,
                timings: result.data.timings,
                completed_at: new Date().toISOString(),
              },
            })
            .eq('id', record.id)

          if (updateError) {
            // Rollback: delete uploaded file
            await supabase.storage.from('user-images').remove([storagePath])
            throw new Error(`Update failed: ${updateError.message}`)
          }

          results.push({ recordId: record.id, status: 'completed' })
        } else if (
          status.status === 'IN_PROGRESS' ||
          status.status === 'IN_QUEUE'
        ) {
          results.push({ recordId: record.id, status: 'pending' })
        } else {
          // Failed or unknown status
          await supabase
            .from('user_images')
            .update({
              status: 'failed',
              generation_error: `FAL generation failed with status: ${status.status}`,
            })
            .eq('id', record.id)

          results.push({ recordId: record.id, status: 'failed' })
        }
      } catch (error) {
        console.error(`Error checking request ${request_id}:`, error)

        // Mark as failed in database
        await supabase
          .from('user_images')
          .update({
            status: 'failed',
            generation_error:
              error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', record.id)

        results.push({
          recordId: record.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  })
