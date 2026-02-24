import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { requireAuth } from '@/lib/server/auth.server'
import { ai } from '@/lib/server/ai.server'

interface GeneratePromptEnhancedInput {
  accessToken: string
  currentPrompt: string // The prompt to enhance
}

// System prompt - Prompt Enhancer
const SYSTEM_PROMPT = `You are a photography prompt enhancer. The user will give you a prompt, and you improve it to make better AI-generated images.

YOUR JOB:
- Take the existing prompt and make it MORE VIVID and SPECIFIC
- Add sensory details, better adjectives, more atmosphere
- Keep the same subject and technical specs
- Make it flow naturally
- Keep it photography-focused

IMPROVEMENTS TO MAKE:
- Vague → Specific ("scientist" → "young scientist in a white lab coat")
- Flat → Atmospheric ("at night" → "bathed in neon glow at midnight")
- Simple → Vivid ("jumping" → "suspended mid-leap, frozen in motion")
- Generic → Unique (add interesting details that make it memorable)

KEEP THE SAME:
- Camera specs (lens, film, framing) - don't change these
- Aspect ratio - preserve it exactly
- Overall subject - enhance, don't replace

EXAMPLES:

Input: "A scientist examining specimens, 50mm f/1.4, CineStill 800T, medium shot --ar 3:2"
Output: "A young scientist in a white lab coat examining glowing bioluminescent specimens under UV light, 50mm f/1.4, CineStill 800T, medium shot --ar 3:2"

Input: "A cat in a window, 85mm f/1.8, Kodak Portra 400 --ar 3:2"
Output: "A sleek black cat perched on a weathered windowsill, backlit by golden afternoon sun, 85mm f/1.8, Kodak Portra 400 --ar 3:2"

Input: "Coffee brewing, 100mm macro, Fujifilm Velvia 50 --ar 16:9"
Output: "Rich espresso streaming into a ceramic cup, captured in slow motion with rising steam, 100mm macro, Fujifilm Velvia 50 --ar 16:9"

Return ONLY the enhanced prompt as plain text (not JSON, just the prompt string).`

/**
 * Enhance an existing prompt using Claude
 * Takes a simple prompt and makes it more vivid and detailed
 */
export const generatePromptEnhanced = createServerFn({ method: 'POST' })
  .inputValidator((data: GeneratePromptEnhancedInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!data.currentPrompt.trim()) {
      throw new Error('No prompt provided to enhance')
    }

    try {
      const response = await generateText({
        model: ai.haiku,
        maxOutputTokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Enhance this prompt:\n\n${data.currentPrompt}`,
          },
        ],
      })

      const enhancedPrompt = response.text.trim()

      const usage = response.usage
      const estimatedCost =
        ((usage.inputTokens ?? 0) * 0.25 + (usage.outputTokens ?? 0) * 1.25) /
        1_000_000

      return {
        prompt: enhancedPrompt,
        metadata: {
          cost: estimatedCost,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens: 0,
        },
      }
    } catch (err) {
      console.error('Claude prompt enhancement error:', err)
      throw new Error(
        `Failed to enhance prompt: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  })
