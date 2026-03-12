import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface GenerateScenesInput {
  story: string
  accessToken: string
}

const SYSTEM_PROMPT = `You are a cinematic scene planner. Given a story, break it down into 8-12 distinct scenes optimized for AI image generation and future video production.

For each scene, produce:
- scene_number: sequential integer
- duration_seconds: estimated duration (3-8 seconds)
- visual_description: A detailed, concrete image generation prompt. Present tense, third person. Describe exactly what the camera sees — specific lighting, colors, textures, composition. No abstract concepts, no dialogue, no internal thoughts. This must work as a standalone image prompt.
- action: What is physically happening in the shot (1 sentence)
- emotion: The dominant mood/feeling (1-2 words)
- framing: One of: "extreme-wide", "wide", "medium-wide", "medium", "medium-close-up", "close-up", "extreme-close-up"
- camera: One of: "static", "push-in", "pull-out", "tracking", "pan", "tilt-up", "tilt-down", "crane", "handheld"
- caption: Voiceover or narration text for this scene (1-2 sentences)

Rules:
- If the story mentions a total duration (e.g. "30 seconds"), calibrate scene count and per-scene durations so they sum to that target
- If no duration is specified, default to 8-12 scenes at 3-8 seconds each
- Vary framing and camera across scenes — don't use the same combination twice in a row
- visual_description should be 2-4 sentences of pure visual detail
- Include establishing shots (wide) and detail shots (close-up)
- Build emotional arc: setup → tension → climax → resolution
- Every scene must be visually distinct from its neighbors

Return ONLY a JSON array of scene objects. No markdown, no commentary.`

export const generateScenes = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateScenesInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!data.story.trim()) {
      throw new Error('Story text is required')
    }

    const { text } = await generateText({
      model: ai.haiku,
      system: SYSTEM_PROMPT,
      prompt: data.story.trim().slice(0, 5000),
    })

    // Parse the JSON response, stripping any markdown fencing
    let cleaned = text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const scenes = JSON.parse(cleaned)

    if (!Array.isArray(scenes)) {
      throw new Error('Expected array of scenes')
    }

    // Normalize and add IDs
     
    const normalized = scenes.map((s: any, i: number) => ({
      id: crypto.randomUUID(),
      scene_number: (s.scene_number as number | undefined) ?? i + 1,
      duration_seconds: (s.duration_seconds as number | undefined) ?? 5,
      visual_description: (s.visual_description as string | undefined) ?? '',
      action: (s.action as string | undefined) ?? '',
      emotion: (s.emotion as string | undefined) ?? '',
      framing: (s.framing as string | undefined) ?? 'medium',
      camera: (s.camera as string | undefined) ?? 'static',
      caption: (s.caption as string | undefined) ?? '',
      image_id: null,
      image_url: null,
    }))

    return { scenes: normalized }
  })
