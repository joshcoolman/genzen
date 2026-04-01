import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

/**
 * AD Chat component catalog for generative UI.
 *
 * Defines components that Claude can render in chat responses,
 * providing interactive experiences beyond plain text.
 */
export const adCatalog = defineCatalog(schema, {
  components: {
    PromptCard: {
      props: z.object({
        prompt: z
          .string()
          .min(10, 'Prompt must be at least 10 characters')
          .max(2000, 'Prompt must be less than 2000 characters'),
        title: z.string().max(100).nullable(),
        tags: z
          .array(z.string().min(1).max(30))
          .max(8, 'Maximum 8 tags allowed')
          .nullable(),
      }),
      description:
        'Display a generated prompt with copy and save actions. Use when providing image generation prompts. Prompt should be detailed (10-2000 chars). Tags should be short keywords (max 8).',
      example: {
        prompt:
          'A cyberpunk city at sunset with neon lights reflecting on wet streets, shot on 35mm film, cinematic composition with deep shadows and vibrant colors',
        title: 'Cyberpunk City',
        tags: ['atmospheric', 'neon', 'urban', 'cinematic'],
      },
    },
  },
  actions: {
    copyPrompt: {
      description: 'Copy prompt text to clipboard',
    },
    savePrompt: {
      description: 'Save prompt to user prompt library',
    },
  },
})
