import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'
import { SUGGEST_LAST_FRAME_SYSTEM } from '@/lib/prompts'
import { createImageStorage } from '@/lib/image-storage'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

interface SuggestLastFrameInput {
  accessToken: string
  firstFramePrompt: string
  firstFrameRecordId?: string
}

export const suggestLastFrame = createServerFn({ method: 'POST' })
  .inputValidator((data: SuggestLastFrameInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)
    const { firstFramePrompt, firstFrameRecordId } = data

    // Try to fetch first frame image for vision grounding if record ID is provided
    let imageBase64:
      | {
          data: string
          mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
        }
      | undefined

    if (firstFrameRecordId) {
      try {
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.VITE_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${data.accessToken}` },
            },
          },
        )

        const { data: record } = await supabase
          .from('user_images')
          .select('storage_path')
          .eq('id', firstFrameRecordId)
          .single()

        const storagePath = (record as { storage_path: string | null } | null)
          ?.storage_path

        if (storagePath) {
          const signedUrl =
            await createImageStorage(supabase).getUrl(storagePath)

          if (signedUrl) {
            const imageRes = await fetch(signedUrl)
            if (imageRes.ok) {
              const buffer = await imageRes.arrayBuffer()
              const bytes = new Uint8Array(buffer)
              let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' =
                'image/jpeg'
              if (bytes[0] === 0x89 && bytes[1] === 0x50)
                mediaType = 'image/png'
              else if (bytes[0] === 0x52 && bytes[1] === 0x49)
                mediaType = 'image/webp'
              imageBase64 = {
                data: Buffer.from(buffer).toString('base64'),
                mediaType,
              }
            }
          }
        }
      } catch {
        // proceed without image grounding
      }
    }

    const userContent = imageBase64
      ? [
          {
            type: 'image' as const,
            image: `data:${imageBase64.mediaType};base64,${imageBase64.data}`,
          },
          {
            type: 'text' as const,
            // Don't re-anchor with the text prompt when we have the image —
            // it causes Claude to reproduce the same description every time.
            text: 'This is the first frame. Write a last frame description.',
          },
        ]
      : `First frame prompt: "${firstFramePrompt}"\n\nWrite a last frame description.`

    const response = await generateText({
      model: ai.reasoning,
      maxOutputTokens: 300,
      temperature: 1.0,
      system: SUGGEST_LAST_FRAME_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })

    return { prompt: response.text.trim() }
  })
