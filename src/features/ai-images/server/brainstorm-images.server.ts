import { createServerFn } from '@tanstack/react-start'
import { fal } from '@fal-ai/client'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

fal.config({ credentials: () => process.env.FAL_KEY ?? '' })

export const COLOR_GRADES = {
  desert_chrome:
    'shadows deep cyan, midtones vivid amber, highlights golden white, skin tones sun-baked and warm, saturation bold, contrast high and crunchy',
  iron_city:
    'shadows cool steel, midtones neutral grey, highlights icy white, skin tones muted natural, contrast high and precise, metallic reflections',
  verde_bloom:
    'shadows soft green, midtones peach, highlights white, skin tones glowing and healthy, contrast low, natural diffusion and vibrance',
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

export const BRAINSTORM_MODELS = {
  schnell: 'fal-ai/flux/schnell',
  dev: 'fal-ai/flux/dev',
} as const

export type BrainstormModelKey = keyof typeof BRAINSTORM_MODELS

const DEFAULT_MODEL: BrainstormModelKey = 'schnell'
const BRAINSTORM_COUNT = 6

const PROMPT_SYSTEM = `You are an expert prompt engineer optimizing for the FLUX.2 Pro image generation model by Black Forest Labs.

Given creative direction, generate exactly 6 distinct image prompts optimized for FLUX.2 Pro.

FLUX.2 Pro prompt best practices:
- Lead with the subject and scene description in natural language — FLUX responds best to descriptive prose, not keyword dumps
- Specify camera/lens explicitly: "shot on 35mm", "85mm f/1.4 bokeh", "anamorphic lens flare", "wide angle 24mm"
- Name lighting setups: "golden hour backlight", "overhead fluorescent", "Rembrandt lighting", "neon-lit"
- Reference real photography styles when helpful: "Kodak Portra 400 film grain", "high-key studio", "documentary style"
- Include one tactile/material detail per prompt: skin texture, fabric weave, wet pavement, dust particles
- FLUX handles text well — feel free to include signage or environmental text if it fits the scene
- Keep each prompt 40-80 words as a single flowing paragraph

Creative rules:
- Each prompt should work as the opening frame of a cinematic video sequence
- Always frame as a dynamic full body shot showing the complete figure head to toe — vary setting, lighting, and mood across all 6
- If subjects are provided, distribute them across the prompts (cycle if fewer than 6)
- No numbering, no labels — just the prompt text`

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

async function generatePrompts(data: BrainstormInput): Promise<Array<string>> {
  const parts: Array<string> = []

  if (data.subjects?.length) {
    parts.push(`Subjects: ${data.subjects.join(', ')}`)
  }
  if (data.role) {
    parts.push(`Role/archetype: ${data.role}`)
  }
  if (data.vibe && data.vibe in BRAINSTORM_VIBES) {
    const v = BRAINSTORM_VIBES[data.vibe]
    parts.push(
      `Vibe: ${data.vibe} (${v.hero} characters, ${v.setting} settings)`,
    )
  }
  if (data.colorGrade && data.colorGrade in COLOR_GRADES) {
    parts.push(
      `Color grade (apply as post-production color treatment, not as scene/setting): ${COLOR_GRADES[data.colorGrade as keyof typeof COLOR_GRADES]}`,
    )
  }

  const userMessage =
    parts.length > 0
      ? parts.join('\n')
      : 'Surprise me with 6 visually striking cinematic hero shots'

  const { text } = await generateText({
    model: ai.geminiFlash,
    system:
      PROMPT_SYSTEM +
      '\n\nReturn ONLY a JSON array of 6 strings. No markdown, no explanation.',
    prompt: userMessage,
  })

  // Strip markdown code fences if present
  let clean = text.trim()
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(clean) as Array<string>
  if (!Array.isArray(parsed) || parsed.length !== BRAINSTORM_COUNT) {
    console.error('[brainstorm] bad prompt count:', parsed.length, parsed)
    throw new Error('LLM returned invalid prompt array')
  }
  return parsed
}

export const brainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: BrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    console.log('[brainstorm] generating prompts via Haiku...')
    let prompts: Array<string>
    try {
      prompts = await generatePrompts(data)
      console.log('[brainstorm] got prompts:', prompts.length)
    } catch (err) {
      console.error('[brainstorm] generatePrompts failed:', err)
      throw err
    }

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

interface RegenerateBrainstormInput {
  accessToken: string
  prompts: Array<string>
  model?: BrainstormModelKey
}

export const regenerateBrainstormImages = createServerFn({ method: 'POST' })
  .inputValidator((data: RegenerateBrainstormInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set')
    }

    const modelId = BRAINSTORM_MODELS[data.model ?? DEFAULT_MODEL]
    const submissions = await Promise.all(
      data.prompts.map((prompt) =>
        fal.queue.submit(modelId, {
          input: { prompt },
        }),
      ),
    )

    return {
      requestIds: submissions.map((s) => s.request_id),
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
