import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import Anthropic from '@anthropic-ai/sdk'

interface GeneratePromptEnhancedInput {
  accessToken: string
  currentPrompt: string // The prompt to enhance
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

const RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    subject: {
      type: 'string' as const,
      description: 'The main subject with descriptive modifiers',
    },
    action: {
      type: 'string' as const,
      description: 'Action or state of the subject',
    },
    medium: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string' as const,
          description: 'The medium description',
        },
        type: {
          type: 'string' as const,
          enum: ['photography', 'art', '3d'],
          description: 'Medium type classification',
        },
      },
      required: ['text', 'type'],
    },
    atmosphere: {
      type: 'string' as const,
      description: 'Lighting and atmospheric mood',
    },
    technical: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description:
        'Technical details appropriate for the medium type (follow commitment logic)',
    },
    wildcard: {
      type: 'string' as const,
      description: 'Optional abstract concept or surprise element',
    },
    aspectRatio: {
      type: 'string' as const,
      pattern: '^\\d+:\\d+$',
      description: 'Aspect ratio in format X:Y',
    },
  },
  required: ['subject', 'action', 'medium', 'atmosphere', 'technical', 'aspectRatio'],
}

/**
 * Enhance an existing prompt using Claude
 * Takes a simple prompt and makes it more vivid and detailed
 */
export const generatePromptEnhanced = createServerFn({ method: 'POST' })
  .inputValidator((data: GeneratePromptEnhancedInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }

    if (!data.currentPrompt?.trim()) {
      throw new Error('No prompt provided to enhance')
    }

    try {
      // Using Haiku 4.5 - fast and cheap for prompt enhancement
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300, // Shorter since we're just enhancing
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Enhance this prompt:\n\n${data.currentPrompt}`,
          },
        ],
      })

      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in response')
      }

      const enhancedPrompt = textContent.text.trim()

      // Calculate cost
      const usage = response.usage
      const estimatedCost =
        ((usage.input_tokens - (usage.cache_read_input_tokens ?? 0)) * 0.25 +
          (usage.cache_read_input_tokens ?? 0) * 0.025 +
          usage.output_tokens * 1.25) /
        1_000_000

      return {
        prompt: enhancedPrompt,
        metadata: {
          cost: estimatedCost,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        },
      }
    } catch (err) {
      console.error('Claude prompt enhancement error:', err)
      throw new Error(
        `Failed to enhance prompt: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  })
