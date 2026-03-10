import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { ai } from '@/lib/server/ai.server'
import { requireAuth } from '@/lib/server/auth.server'

interface GenerateShotPromptsInput {
  description: string
  promptTemplate: string
  accessToken: string
}

export const generateShotPrompts = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateShotPromptsInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const { text } = await generateText({
      model: ai.haiku,
      system: `You are a prompt engineer for image generation. You will be given an image description and a template instruction. Follow the template instruction to produce multiple image generation prompts. Separate each prompt with a single asterisk (*) on its own. Output ONLY the prompts separated by asterisks -- no headers, numbering, labels, or commentary.`,
      messages: [
        {
          role: 'user',
          content: `Image description:\n${data.description}\n\nInstruction:\n${data.promptTemplate}`,
        },
      ],
    })

    return { rawOutput: text.trim() }
  })
