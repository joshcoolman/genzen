import type { SavedAiImage } from './types'

type Metadata = SavedAiImage['generation_metadata']

/**
 * The prompt to show for a generation: what produced *this* picture.
 *
 * For an ordinary row that is `prompt`, the textarea contents (#367). For a
 * storyboard shot it is not: every image in a set is submitted under the same
 * typed invocation, so all ten cards captioned themselves with the brief --
 * "/storyboard I need a bunch of shots for it..." ten times, on ten visibly
 * different pictures. The one thing a caption is for, telling them apart, was
 * the one thing it could not do.
 *
 * The shot's own description is read out of `image_skill`, which the row has
 * carried since #626. Derived rather than written, so rows generated before
 * this read correctly too -- and so `prompt` keeps meaning what the user
 * typed, which is what Load into generator restores and what Retry falls back
 * to. Neither should get the description: loading one shot of a set back into
 * the panel is a different feature (Populate), not this caption.
 *
 * `sent_prompt` is not the answer either. That is the whole assembled string
 * -- render instruction, continuity and shot as JSON -- which is what FAL
 * received and unreadable as a caption.
 */
export function displayPrompt(metadata: Metadata): string | undefined {
  const shot = shotDescription(metadata)
  return shot ?? metadata?.prompt
}

/**
 * Typed loosely on purpose. `image_skill` is parsed JSON off a row that may
 * predate any given field -- v1 contact-sheet metadata has no per-shot plan at
 * all -- so the declared type describes what is written today, not what is
 * stored. Reading it as the declared shape makes every guard here look
 * redundant to the compiler and the linter, and then one missing field is a
 * crash in a caption.
 */
interface StoredShot {
  number?: number
  description?: string
}
interface StoredSkill {
  shotNumber?: number
  plan?: { shots?: Array<StoredShot> }
}

function shotDescription(metadata: Metadata): string | undefined {
  const skill: StoredSkill | undefined = metadata?.image_skill
  if (!skill) return undefined
  const number = skill.shotNumber ?? metadata?.storyboard_shot
  const found = skill.plan?.shots?.find((s) => s.number === number)
  return found?.description?.trim() || undefined
}
