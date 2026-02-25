import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

const SYSTEM_PROMPT = `You are generating a last frame for a first-frame-to-last-frame (FLF) video system. The video model interpolates smoothly BETWEEN the two frames — so they must be nearly identical in composition or the result will look like a broken morph.

Rules:
- Keep EXACTLY the same camera angle, framing, and composition as the first frame
- Change only ONE subtle thing: a slight camera drift, a tiny motion completion, a very gentle lighting shift
- The last frame should look like a still taken 2-4 seconds after the first — same shot, barely moved
- Same subject, same background, same depth of field, same lighting direction
- Do NOT describe a new angle, a cut, a different scene, or any significant transformation

The minimum change that implies motion is the right answer. Ask yourself: if someone compared these two frames side by side, would they look nearly identical? They should.

Return ONLY the last frame description as plain text. No preamble, no explanation.`

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
            // Don't re-anchor with the text prompt when we have the image —
            // it causes Claude to reproduce the same description every time.
            text: 'This is the first frame. Write a last frame description.',
          },
        ]
      : `First frame prompt: "${firstFramePrompt}"\n\nWrite a last frame description.`

    const response = await generateText({
      model: ai.sonnet,
      maxOutputTokens: 300,
      temperature: 1.0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    return { prompt: response.text.trim() }
  })
