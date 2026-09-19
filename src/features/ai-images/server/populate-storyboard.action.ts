'use server'

import { parsePromptInvocation, storyboardShotCount } from '../skills/registry'
import { runStoryboardPlan } from './storyboard.server'
import { resolveAuth } from '#/lib/server/auth.server'

/**
 * Plan a storyboard brief into editable prompts, and stop there.
 *
 * The other half of #714. Generate plans and renders in one press; this runs
 * the plan alone -- one Claude call, no images, nothing charged by FAL -- and
 * hands back plain prompt strings for the panel's prompt list. The user then
 * picks models, adjusts the ratio, edits or deletes rows, and presses Generate,
 * which takes the ordinary path.
 *
 * Each returned prompt stands alone, because these never pass through the
 * storyboard submit again: what was shared state in the plan (the held
 * description, the reference roles) is folded into every string.
 *
 * What is deliberately NOT folded in is `render-shot.md`'s boilerplate about
 * sheets, grids and margins. That exists because the storyboard path renders
 * a member of a set through a single-image endpoint; a populated prompt IS an
 * ordinary single-image prompt, so the boilerplate would be nine copies of
 * noise in a list whose entire purpose is being read.
 *
 * References are staged at Generate time like any other prompt -- the prompt
 * list holds text and nothing else. Where the set varies by which reference
 * each image is about, the fold below names it in words so the prompt still
 * says which subject it means.
 */
export async function populateStoryboard(data: {
  originalInput: string
  referenceIds: Array<string>
  systemInstructions?: string
}) {
  const { userId } = await resolveAuth()
  const invocation = parsePromptInvocation(data.originalInput)
  if (invocation.kind !== 'skill')
    throw new Error('Populate needs a /storyboard command.')
  const { plan } = await runStoryboardPlan(
    {
      brief: invocation.brief,
      referenceIds: data.referenceIds,
      ...(data.systemInstructions
        ? { systemInstructions: data.systemInstructions }
        : {}),
    },
    userId,
    storyboardShotCount(invocation.brief),
  )
  const roles = new Map(plan.references.map((r) => [r.image, r.role]))
  const prompts = plan.shots.map((shot) => {
    const used = shot.referenceImages
      .map((n) => `image ${n} (${roles.get(n) ?? 'reference'})`)
      .join(', ')
    return [
      shot.description,
      `Consistent across this set: ${plan.continuity}`,
      used ? `This one is about ${used}.` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  })
  return {
    prompts,
    aspectRatio: plan.shotAspectRatio,
    ordered: plan.ordered,
    held: plan.held,
    varies: plan.varies,
  }
}
