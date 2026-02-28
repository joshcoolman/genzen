import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import type { SuggestPromptContext } from '@/lib/prompts/suggest-prompt'
import { generatePromptComponents } from '@/lib/prompt-components/prompt-generator'
import { ai } from '@/lib/server/ai.server'
import { requireAuth } from '@/lib/server/auth.server'
import { SUGGEST_PROMPT_SYSTEMS } from '@/lib/prompts/suggest-prompt'

interface SuggestPromptInput {
  accessToken: string
  context: SuggestPromptContext
}

export const suggestPrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: SuggestPromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const components = generatePromptComponents()

    const parts = [`${components.subjectType}`]

    if (components.subjectType === 'person') {
      if (components.ethnicity) parts.push(components.ethnicity)
      if (components.gender) parts.push(components.gender)
      if (components.age) parts.push(components.age)
      if (components.descriptor) parts.push(components.descriptor)
      if (components.bodyType) parts.push(components.bodyType)
      if (components.profession) parts.push(components.profession)
    } else if (components.subjectType === 'couple') {
      if (components.relationship) parts.push(components.relationship)
      if (components.ethnicity) parts.push(components.ethnicity)
      if (components.age) parts.push(components.age)
      if (components.descriptor) parts.push(components.descriptor)
    } else if (components.subjectType === 'animal') {
      if (components.animalType) parts.push(components.animalType)
      if (components.descriptor) parts.push(components.descriptor)
    } else if (components.subjectType === 'object') {
      if (components.objectType) parts.push(components.objectType)
      if (components.descriptor) parts.push(components.descriptor)
    } else if (components.subjectType === 'place') {
      if (components.placeType) parts.push(components.placeType)
      if (components.descriptor) parts.push(components.descriptor)
    }

    if (components.action) parts.push(components.action)
    if (components.environment) parts.push(components.environment)

    // Include camera specs for image context only
    if (data.context === 'image') {
      parts.push(components.lens)
      parts.push(components.film)
      if (components.framing) parts.push(components.framing)
      parts.push(components.aspectRatio)
    }

    const componentString = `Components: ${parts.join(', ')}`
    const system = SUGGEST_PROMPT_SYSTEMS[data.context]

    const response = await generateText({
      model: ai.haiku,
      maxOutputTokens: 200,
      system,
      messages: [{ role: 'user', content: componentString }],
    })

    return { prompt: response.text.trim() }
  })
