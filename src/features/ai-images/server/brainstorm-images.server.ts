import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { C } from 'vitest/dist/chunks/reporters.d.BFLkQcL6.js'
import { requireAuth } from '@/lib/server/auth.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export const COLOR_GRADES = {
  desert_chrome:
    'shadows deep cyan, midtones vivid amber, highlights golden white, skin tones sun-baked and warm, saturation bold, contrast high and crunchy, atmosphere blistering desert heat',
  iron_city:
    'shadows cool steel, midtones neutral grey, highlights icy white, skin tones muted natural, contrast high and precise, metallic reflections, atmosphere tense and industrial',
  verde_bloom:
    'shadows soft green, midtones peach, highlights white, skin tones glowing and healthy, contrast low, natural diffusion and vibrance, atmosphere calm and romantic',
}

export const COLOR_GRADING_PROMPT = COLOR_GRADES.verde_bloom;


export const BRAINSTORM_PROMPT =
  'A dynamic full body shot of an unusual hero in an interesting setting, establishing shot, suitable for the first frame of a photorealistic video sequence' 

const BRAINSTORM_MODEL = 'fal-ai/flux/schnell'
const BRAINSTORM_COUNT = 6

interface BrainstormInput {
  accessToken: string
}

interface CheckBrainstormInput {
  accessToken: string
  requestIds: Array<string>
}

export const brainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: BrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const submissions = await Promise.all(
      Array.from({ length: BRAINSTORM_COUNT }, () =>
        fal.queue.submit(BRAINSTORM_MODEL, {
          input: {
            prompt: BRAINSTORM_PROMPT,
            safety_tolerance: 6,
          },
        }),
      ),
    )

    return { requestIds: submissions.map((s) => s.request_id) }
  })

export const checkBrainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckBrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const results = await Promise.all(
      data.requestIds.map(async (requestId) => {
        try {
          const status = await fal.queue.status(BRAINSTORM_MODEL, {
            requestId,
            logs: false,
          })

          if (status.status === 'COMPLETED') {
            const result = await fal.queue.result(BRAINSTORM_MODEL, {
              requestId,
            })
            const images = (result.data as { images: Array<{ url: string }> })
              .images
            const url = images[0]?.url ?? null
            return { requestId, status: 'completed' as const, url }
          }

          if (status.status === 'FAILED') {
            return { requestId, status: 'failed' as const, url: null }
          }

          return { requestId, status: 'pending' as const, url: null }
        } catch {
          return { requestId, status: 'failed' as const, url: null }
        }
      }),
    )

    return results
  })
