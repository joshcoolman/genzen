import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const SYSTEM_PROMPT = `You are a cinematographer directing an AI video using the first-frame to last-frame (FLF) technique. You have been given the first frame of a video — either as a description or an image — and your job is to write a compelling last frame prompt.

The last frame should:
- Feature the SAME subject, environment, and visual style as the first frame
- Show clear cinematic evolution — a different moment, angle, or stage of motion
- Create interesting visual tension between the two frames (the video will interpolate between them)
- Be specific: name camera position, subject state, lighting condition, and film aesthetic
- Feel like a natural continuation, not a jump cut

Think in terms of: what has changed? The camera angle, the car's position on track, the lighting shift, the crowd reaction, a drift completing, a corner exit — pick one clear change and describe it vividly.

Return ONLY the last frame prompt as plain text. No preamble, no explanation.`

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
          const { data: signedUrlData } = await supabase.storage
            .from('user-images')
            .createSignedUrl(storagePath, 3600)

          if (signedUrlData?.signedUrl) {
            const imageRes = await fetch(signedUrlData.signedUrl)
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
            text: `This is the first frame of the video. The prompt used to generate it was: "${firstFramePrompt}"\n\nWrite a compelling last frame prompt that creates clear cinematic evolution from this frame.`,
          },
        ]
      : `First frame prompt: "${firstFramePrompt}"\n\nWrite a compelling last frame prompt that creates clear cinematic evolution from this scene.`

    const response = await generateText({
      model: ai.sonnet,
      maxOutputTokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    return { prompt: response.text.trim() }
  })
