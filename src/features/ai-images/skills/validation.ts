import { z } from 'zod'
import { getModelName, imageCapacityFor } from '../models'
import type { StoryboardPlan } from './types'

const prose = z.string().trim().min(1).max(6000)

/**
 * Ratios a plan may choose. Wider than any one renderer accepts; the layout
 * resolver snaps to the nearest the selected model actually offers, so this is
 * the vocabulary of the decision rather than a promise about the output.
 */
export const STORYBOARD_ASPECT_RATIOS = [
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '1:1',
  '3:4',
  '2:3',
  '9:16',
] as const

export const storyboardPlanSchema = z.object({
  /** What is the same in every image. Written once; the renderer is stateless. */
  continuity: prose,
  /** The two halves of the one decision: what is held, and what changes. */
  held: prose,
  varies: prose,
  /** A storyboard is a set ordered by time. Most sets are not one. */
  ordered: z.boolean(),
  references: z
    .array(z.object({ image: z.number().int().min(1).max(16), role: prose }))
    .max(16),
  shots: z
    .array(
      z.object({
        number: z.number().int().min(1).max(9),
        description: prose,
        referenceImages: z.array(z.number().int().min(1).max(16)).max(16),
        /** This image's own shape, when it differs from the set's (#714).
         *  Absent is the normal case and means "the same as everything
         *  else"; a set only spells it out where the brief asked for a
         *  mixture. */
        aspectRatio: z.enum(STORYBOARD_ASPECT_RATIOS).optional(),
      }),
    )
    .min(2)
    .max(9),
  /** The shape of the set. A shot may override it with its own. */
  shotAspectRatio: z.enum(STORYBOARD_ASPECT_RATIOS),
})

/** The shape this shot renders at: its own, or the set's. */
export function shotRatio(
  plan: Pick<StoryboardPlan, 'shotAspectRatio'>,
  shot?: { aspectRatio?: string },
) {
  return shot?.aspectRatio ?? plan.shotAspectRatio
}

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
