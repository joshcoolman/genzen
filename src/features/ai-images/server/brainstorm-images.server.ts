import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
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

export const COLOR_GRADING_PROMPT = COLOR_GRADES.verde_bloom

export const BRAINSTORM_VIBES = {
  unusual: { hero: 'unusual', setting: 'interesting' },
  cinematic: { hero: 'striking', setting: 'dramatic' },
  gritty: { hero: 'battle-hardened', setting: 'harsh' },
  ethereal: { hero: 'otherworldly', setting: 'surreal' },
  professional: { hero: 'polished', setting: 'studio-lit professional' },
} as const

export type BrainstormVibeKey = keyof typeof BRAINSTORM_VIBES

export const BRAINSTORM_PROMPT =
  'A dynamic full body shot of an unusual hero in an interesting setting, establishing shot, suitable for the first frame of a photorealistic video sequence'

function buildBrainstormPrompt(opts: {
  subject?: string
  role?: string
  vibe?: BrainstormVibeKey
  colorGrade?: string
}): string {
  const v = BRAINSTORM_VIBES[opts.vibe ?? 'unusual']
  const character = opts.subject
    ? `a ${v.hero} ${opts.subject} ${opts.role ?? 'hero'}`
    : `a ${v.hero} ${opts.role ?? 'hero'}`
  let prompt = BRAINSTORM_PROMPT.replace('an unusual hero', character).replace(
    'an interesting setting',
    `a ${v.setting} setting`,
  )
  if (opts.colorGrade && opts.colorGrade in COLOR_GRADES) {
    prompt += ', ' + COLOR_GRADES[opts.colorGrade as keyof typeof COLOR_GRADES]
  }
  return prompt
}

function distributeSubjects(
  subjects: Array<string>,
  count: number,
): Array<string | undefined> {
  if (subjects.length === 0)
    return Array.from({ length: count }, () => undefined)
  const result: Array<string | undefined> = []
  for (let i = 0; i < count; i++) {
    result.push(subjects[i % subjects.length])
  }
  return result
}

export const BRAINSTORM_MODELS = {
  schnell: 'fal-ai/flux/schnell',
  dev: 'fal-ai/flux/dev',
} as const

export type BrainstormModelKey = keyof typeof BRAINSTORM_MODELS

const DEFAULT_MODEL: BrainstormModelKey = 'schnell'
const BRAINSTORM_COUNT = 6

interface BrainstormInput {
  accessToken: string
  subjects?: Array<string>
  role?: string
  vibe?: BrainstormVibeKey
  colorGrade?: string
  model?: BrainstormModelKey
}

interface CheckBrainstormInput {
  accessToken: string
  requestIds: Array<string>
  model?: BrainstormModelKey
}

export const brainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: BrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const distributed = distributeSubjects(
      data.subjects ?? [],
      BRAINSTORM_COUNT,
    )
    const prompts = distributed.map((subject) =>
      buildBrainstormPrompt({
        subject,
        role: data.role,
        vibe: data.vibe,
        colorGrade: data.colorGrade,
      }),
    )

    const modelId = BRAINSTORM_MODELS[data.model ?? DEFAULT_MODEL]
    const submissions = await Promise.all(
      prompts.map((prompt) =>
        fal.queue.submit(modelId, {
          input: { prompt },
        }),
      ),
    )

    return {
      requestIds: submissions.map((s) => s.request_id),
      prompts,
    }
  })

export const checkBrainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckBrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const modelId = BRAINSTORM_MODELS[data.model ?? DEFAULT_MODEL]
    const results = await Promise.all(
      data.requestIds.map(async (requestId) => {
        try {
          const status = await fal.queue.status(modelId, {
            requestId,
            logs: false,
          })

          if (status.status === 'COMPLETED') {
            const result = await fal.queue.result(modelId, {
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
