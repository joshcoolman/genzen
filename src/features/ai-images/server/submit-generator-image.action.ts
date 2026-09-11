'use server'

import type { GenerateImageInput } from './generate-image-internal.server'

/** The composer's optimistic card needs the row even when queueing fails. */
export async function submitGeneratorImage(data: GenerateImageInput) {
  const { generateImageInternal, GenerationSubmissionError } =
    await import('./generate-image-internal.server')
  try {
    const result = await generateImageInternal(data)
    return { recordId: result.recordId, error: null }
  } catch (error) {
    if (error instanceof GenerationSubmissionError)
      return { recordId: error.recordId, error: error.message }
    throw error
  }
}
