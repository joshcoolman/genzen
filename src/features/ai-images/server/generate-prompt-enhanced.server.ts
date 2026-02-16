import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import Anthropic from '@anthropic-ai/sdk'

interface GeneratePromptEnhancedInput {
  accessToken: string
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// System prompt with all rules (will be cached to reduce costs)
const SYSTEM_PROMPT = `You are an expert AI image prompt generator specializing in sophisticated prompts for diffusion models like Flux, SDXL, and Ideogram.

ARCHITECTURE - Five-Bucket Structure (Order Matters):
1. SUBJECT (front-loaded, most important) - The main focus with vivid descriptors
2. ACTION/STATE - What the subject is doing or its current state
3. MEDIUM - The artistic medium (photography, traditional art, digital art, 3D render)
4. ATMOSPHERE - Lighting, mood, color grading
5. TECHNICAL DETAILS - Medium-specific technical elements

CRITICAL COMMITMENT LOGIC (MUST FOLLOW):
Based on the medium type, you MUST include appropriate technical details and MUST NOT mix incompatible elements:

IF MEDIUM IS PHOTOGRAPHY:
  ✓ MUST include: Camera lens specs (e.g., "85mm f/1.8", "50mm f/1.4")
  ✓ MUST include: Film stock OR digital camera (e.g., "Kodak Portra 400", "Fujifilm Velvia 50")
  ✓ MAY include: Shot framing (e.g., "Close-Up", "Bird's-Eye View", "Dutch Angle")
  ✗ MUST NOT include: Art techniques (impasto, glazing, etc.)
  ✗ MUST NOT include: 3D render terms (ray-traced, PBR, etc.)

IF MEDIUM IS ART (painting, drawing, print):
  ✓ MUST include: Art techniques (e.g., "Thick impasto texture", "Cross-hatching", "Wet-on-wet blending")
  ✓ MAY include: Artistic style/movement (e.g., "Impressionist", "Art Nouveau", "Ukiyo-e")
  ✓ MAY include: Compositional framing
  ✗ MUST NOT include: Camera lens specs (no "85mm f/1.8")
  ✗ MUST NOT include: Film stocks (no "Kodak", "Fujifilm")
  ✗ MUST NOT include: 3D render terms

IF MEDIUM IS 3D RENDER:
  ✓ MUST include: Render engine/technique (e.g., "Path-traced global illumination", "Ray-traced reflections", "PBR materials")
  ✓ MAY include: Technical details (e.g., "Volumetric fog", "Subsurface scattering", "8K resolution")
  ✓ MAY include: Framing
  ✗ MUST NOT include: Camera lens specs
  ✗ MUST NOT include: Film stocks
  ✗ MUST NOT include: Art techniques (impasto, glazing)

STYLE GUIDELINES:
- Descriptive but concise (aim for 1-2 sentences total)
- Specific over generic ("A crystalline lighthouse dissolving into particles" not "A cool building")
- Use precise technical terms (exact lens focal lengths, named techniques, specific film stocks)
- Create surprising combinations (30% chance: use contrasting adjectives like "Mechanical cathedral", "Ethereal workshop")
- Add unexpected elements (15% chance: include abstract concepts like "Liminal space", "Trompe-l'oeil illusion")

ASPECT RATIOS:
Choose an appropriate aspect ratio for the composition:
- Landscape: 16:9 (cinematic), 3:2 (classic photo), 21:9 (ultra-wide)
- Portrait: 2:3 (photo), 9:16 (vertical), 4:5 (social)
- Square: 1:1
- Prefer 16:9 and 3:2 most frequently

EXAMPLES OF GOOD PROMPTS:

Photography:
"A nomadic merchant carrying lanterns reading by candlelight, 35mm street photography, Golden hour warmth, 85mm f/1.8 portrait lens, Kodak Portra 400, Medium Close-Up --ar 3:2"

Art:
"An overgrown lighthouse on a floating island emerging from fog, Oil painting on canvas, Volumetric god rays, Thick impasto texture, Atmospheric perspective, Chiaroscuro lighting --ar 16:9"

3D Render:
"A mechanical owl with telescope eyes suspended in zero gravity, Unreal Engine 5 cinematic render, Neon-lit cityscape glow, Path-traced global illumination, Ray-traced reflections, Depth of field blur --ar 21:9"

Generate creative, surprising prompts that follow all rules precisely.`

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
 * Generate an AI-enhanced prompt using Claude with structured output
 * Uses prompt caching to reduce costs (~90% reduction on repeated calls)
 */
export const generatePromptEnhanced = createServerFn({ method: 'POST' })
  .inputValidator((data: GeneratePromptEnhancedInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }, // Cache the system prompt!
          },
        ],
        messages: [
          {
            role: 'user',
            content: 'Generate a creative image prompt following all rules.',
          },
        ],
      })

      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in response')
      }

      // Parse the structured JSON response
      const parts = JSON.parse(textContent.text)

      // Validate basic structure
      if (!parts.subject || !parts.medium || !parts.aspectRatio) {
        throw new Error('Invalid response structure from Claude')
      }

      // Assemble the final prompt
      const segments = [
        `${parts.subject} ${parts.action}`,
        parts.medium.text,
        parts.atmosphere,
        ...parts.technical,
      ]

      if (parts.wildcard) {
        segments.push(parts.wildcard)
      }

      const prompt = `${segments.join(', ')} --ar ${parts.aspectRatio}`

      // Calculate cost for transparency
      const usage = response.usage
      const estimatedCost =
        ((usage.input_tokens - (usage.cache_read_input_tokens ?? 0)) * 3 +
          (usage.cache_read_input_tokens ?? 0) * 0.3 +
          usage.output_tokens * 15) /
        1_000_000

      return {
        prompt,
        metadata: {
          mediumType: parts.medium.type,
          hasWildcard: !!parts.wildcard,
          aspectRatio: parts.aspectRatio,
          technicalCount: parts.technical.length,
          // Cost tracking for future monetization
          cost: estimatedCost,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
        },
      }
    } catch (err) {
      console.error('Claude prompt generation error:', err)
      throw new Error(
        `Failed to generate enhanced prompt: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  })
