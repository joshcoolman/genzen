import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface GenerateImageInput {
  prompt: string
  model: string
  accessToken: string
}

export const generateImage = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const { prompt, model } = data

    if (!prompt.trim()) {
      throw new Error('Prompt is required')
    }

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    // Submit to FAL async queue (returns immediately)
    const { request_id } = await fal.queue.submit(model, {
      input: { prompt, safety_tolerance: 6 },
    })

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

    // Create database record with pending status
    const { data: record, error: insertError } = await supabase
      .from('user_images')
      .insert({
        user_id: user.id,
        request_id: request_id,
        status: 'pending',
        source: 'ai_generated',
        title: 'Generating...',
        generation_metadata: {
          prompt,
          model,
          submitted_at: new Date().toISOString(),
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
      prompt,
      model,
    }
  })
