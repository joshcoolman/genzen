import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface GenerateScenesInput {
  story: string
  accessToken: string
}

const SYSTEM_PROMPT = `You are a Director of Photography planning shots for AI video generation. Given a story, break it down into 8-12 distinct scenes with rich cinematographic detail optimized for AI image and video generation.

Return a JSON object with two top-level keys:

1. "characters" — an array of 2-4 PRIMARY characters only — protagonists and key figures who appear in multiple scenes. Omit minor/background characters; AI generates appropriate extras during frame generation.
   - slug: kebab-case identifier (e.g. "hero", "detective")
   - name: display name (e.g. "The Hero", "Detective Morales")
   - description: detailed visual description for image generation — physical appearance, clothing, distinguishing features, age, build. 2-3 sentences of concrete visual detail. No personality or backstory. If a character spans ages, use ONE entry for the primary version and note variants in description.

2. "scenes" — an array of 8-12 scene objects:
   - scene_number: sequential integer
   - duration_seconds: estimated duration (3-8 seconds)
   - visual_description: A detailed, concrete image generation prompt. Present tense, third person. Describe exactly what the camera sees — specific lighting, colors, textures, composition. No abstract concepts, no dialogue, no internal thoughts. This must work as a standalone image prompt.
   - action: What is physically happening in the shot (1 sentence)
   - emotion: The dominant mood/feeling (1-2 words)
   - framing: One of: "extreme-wide", "wide", "medium-wide", "medium", "medium-close-up", "close-up", "extreme-close-up"
   - camera: One of: "static", "push-in", "pull-out", "tracking", "pan", "tilt-up", "tilt-down", "crane", "handheld"
   - lighting: Specific lighting setup (e.g. "golden hour warm light", "harsh overhead fluorescent", "rim lighting with dark background", "neon-lit rain", "Rembrandt lighting", "volumetric fog with backlight", "soft diffused overcast")
   - lens: Camera lens spec (e.g. "85mm f/1.4", "wide angle 24mm", "50mm f/2.8", "35mm f/1.8", "telephoto 200mm")
   - angle: Camera angle (e.g. "eye level", "low angle", "high angle", "bird's eye", "dutch tilt", "worm's eye", "over-the-shoulder")
   - caption: Voiceover or narration text for this scene (1-2 sentences)
   - characters: array of character slugs present in this scene

Rules:
- If the story mentions a total duration (e.g. "30 seconds"), calibrate scene count and per-scene durations so they sum to that target
- If no duration is specified, default to 8-12 scenes at 3-8 seconds each
- Vary framing, camera, lighting, lens, and angle across scenes for visual variety
- visual_description should be 2-4 sentences of pure visual detail
- Include establishing shots (wide) and detail shots (close-up)
- Build emotional arc: setup → tension → climax → resolution
- Every scene must be visually distinct from its neighbors
- Maximum 4 characters. Only characters central to the story arc
- Do NOT create separate entries for different ages/stages of the same character
- CRITICAL: Each scene must depict a SINGLE FROZEN MOMENT in time — one specific instant that a camera could photograph
- Never describe montages, sequences, time-lapses, or multiple actions happening over time
- Every element in visual_description must be visually concrete and photographable — no abstract concepts, metaphors, or internal states
- Avoid phrases like "we see", "the camera reveals", "over time", "gradually", "a series of", "various moments"
- Use lighting to reinforce emotion: warm tones for comfort, cold/harsh for tension, dramatic rim lighting for climax moments
- Match lens choice to framing: wide-angle for establishing shots, telephoto for intimate close-ups, 50mm for natural perspective
- Vary camera angles to create visual rhythm — don't default to eye level for every shot

Return ONLY the JSON object. No markdown, no commentary.`

export const generateScenes = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateScenesInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!data.story.trim()) {
      throw new Error('Story text is required')
    }

    const { text } = await generateText({
      model: ai.fast,
      system: SYSTEM_PROMPT,
      prompt: data.story.trim().slice(0, 5000),
    })

    // Parse the JSON response, stripping any markdown fencing
    let cleaned = text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(cleaned)

    // Support both old format (bare array) and new format ({ characters, scenes })
    const rawScenes = Array.isArray(parsed) ? parsed : parsed.scenes
    const rawCharacters = Array.isArray(parsed) ? [] : (parsed.characters ?? [])

    if (!Array.isArray(rawScenes)) {
      throw new Error('Expected scenes array in response')
    }

    const characters = (rawCharacters as Array<any>).map((c: any) => ({
      slug: String(c.slug || ''),
      name: String(c.name || ''),
      description: String(c.description || ''),
      reference_images: [],
    }))

    const scenes = rawScenes.map((s: any, i: number) => ({
      id: crypto.randomUUID(),
      scene_number: (s.scene_number as number | undefined) ?? i + 1,
      duration_seconds: (s.duration_seconds as number | undefined) ?? 5,
      visual_description: (s.visual_description as string | undefined) ?? '',
      action: (s.action as string | undefined) ?? '',
      emotion: (s.emotion as string | undefined) ?? '',
      framing: (s.framing as string | undefined) ?? 'medium',
      camera: (s.camera as string | undefined) ?? 'static',
      lighting: (s.lighting as string | undefined) ?? '',
      lens: (s.lens as string | undefined) ?? '',
      angle: (s.angle as string | undefined) ?? 'eye level',
      caption: (s.caption as string | undefined) ?? '',
      characters: Array.isArray(s.characters) ? s.characters : [],
      generation_notes: '',
      reference_images: [],
      image_id: null,
      image_url: null,
      generated_frames: [],
    }))

    return { scenes, characters }
  })
