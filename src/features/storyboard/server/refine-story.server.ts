import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface RefineStoryInput {
  story: string
  accessToken: string
}

const SYSTEM_PROMPT = `You are a visual story editor. Your job is to take a rough idea and expand it into a short, visually rich narrative (2-3 paragraphs, 150-250 words) optimized for cinematic image generation.

Structure the story for visual variety:
- Include 2-3 distinct locations or settings (not all in one room)
- Give characters visual specificity (clothing, posture, distinguishing features -- not just "a man")
- Include at least one significant object or prop the camera could hero-shot
- Build in a mood shift (calm to tense, dark to bright, quiet to chaotic)
- Each paragraph should contain a different filmable moment

Think of it as writing a short film treatment where every sentence could be a camera setup. Favor concrete, visible details over internal thoughts or dialogue.

Keep the user's core concept and characters. Write in present tense, third person. Return ONLY the refined story -- no commentary, no quotes.`

export const refineStory = createServerFn({ method: 'POST' })
  .inputValidator((data: RefineStoryInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!data.story.trim()) {
      throw new Error('Story text is required')
    }

    const { text } = await generateText({
      model: ai.fast,
      system: SYSTEM_PROMPT,
      prompt: data.story.trim().slice(0, 3000),
    })

    return { story: text.trim() }
  })
