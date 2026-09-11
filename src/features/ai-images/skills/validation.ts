import { z } from 'zod'
import { getModelName, imageCapacityFor } from '../models'
import type { StoryboardPlan } from './types'

const prose = z.string().trim().min(1).max(6000)
export const storyboardPlanSchema = z.object({
  continuity: prose,
  references: z
    .array(z.object({ image: z.number().int().min(1).max(16), role: prose }))
    .max(16),
  shots: z
    .array(
      z.object({
        number: z.number().int().min(1).max(9),
        description: prose,
        referenceImages: z.array(z.number().int().min(1).max(16)).max(16),
      }),
    )
    .min(2)
    .max(9),
  shotAspectRatio: z.literal('16:9'),
})

export function validateStoryboardPlan(
  value: unknown,
  referenceCount: number,
  shotCount?: number,
): StoryboardPlan {
  const result = storyboardPlanSchema.safeParse(value)
  if (!result.success)
    throw new Error(
      'Storyboard planning returned an invalid plan. Try again or simplify the scene idea.',
    )
  const plan = result.data
  if (shotCount != null && plan.shots.length !== shotCount)
    throw new Error(
      `Storyboard planning returned ${plan.shots.length} shots instead of ${shotCount}. Try again.`,
    )
  if (
    plan.references.length !== referenceCount ||
    plan.references.some((r, i) => r.image !== i + 1)
  )
    throw new Error(
      'Storyboard planning did not preserve the numbered references. Try again.',
    )
  if (
    plan.shots.some(
      (s, i) =>
        s.number !== i + 1 ||
        new Set(s.referenceImages).size !== s.referenceImages.length ||
        s.referenceImages.some((r) => r > referenceCount),
    )
  )
    throw new Error(
      'Storyboard planning returned invalid shot order or reference assignments. Try again.',
    )
  return plan
}

export function validateSkillReferences(
  models: Array<string>,
  referenceIds: Array<string>,
) {
  if (!models.length) throw new Error('Select an image model for Storyboard.')
  if (
    referenceIds.length > 16 ||
    referenceIds.some((id) => !z.uuid().safeParse(id).success) ||
    new Set(referenceIds).size !== referenceIds.length
  )
    throw new Error(
      'Storyboard needs an ordered set of at most 16 distinct library images.',
    )
  for (const model of models) {
    const capacity = imageCapacityFor(model)
    if (referenceIds.length > capacity)
      throw new Error(
        `${getModelName(model)} holds ${capacity} reference images; Storyboard needs all ${referenceIds.length}. Remove references or choose a model with enough capacity.`,
      )
    if (referenceIds.length && model.includes('z-image/'))
      throw new Error(
        'Z-Image Turbo edits cannot render a new storyboard from references. Choose an instruction-following image model.',
      )
  }
}
