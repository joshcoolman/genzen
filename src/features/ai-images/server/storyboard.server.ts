import { randomUUID } from 'node:crypto'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import { endpointFor } from '../models'
import {
  IMAGE_SKILLS,
  parsePromptInvocation,
  storyboardShotCount,
} from '../skills/registry'
import {
  STORYBOARD_ASPECT_RATIOS,
  storyboardPlanSchema,
  validateSkillReferences,
  validateStoryboardPlan,
} from '../skills/validation'
import {
  layoutForSchema,
  resolveStoryboardLayout,
} from './storyboard-layout.server'
import { fetchModelSchema } from './fal-schema.server'
import type { PreparedImageSkill } from '../skills/types'
import type { ImagePart, TextPart } from 'ai'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'
import { loadVisionImage } from '#/lib/server/vision-image.server'

const requestSchema = z.object({
  skillId: z.literal('storyboard'),
  brief: z.string().trim().min(1).max(12000),
  originalInput: z.string().min(1).max(13000).optional(),
  referenceIds: z.array(z.uuid()).max(16),
  models: z.array(z.string().min(1)).min(1).max(30),
  systemInstructions: z.string().max(12000).optional(),
})

export async function prepareImageSkillInternal(
  input: z.input<typeof requestSchema>,
) {
  const { userId } = await resolveAuth()
  const data = requestSchema.parse(input)
  // Explicit dispatch; registry entries never contain executable instructions.
  const handlers = { storyboard: prepareStoryboard }
  return handlers[data.skillId](
    {
      ...data,
      originalInput: data.originalInput ?? `/storyboard ${data.brief}`,
    },
    userId,
  )
}

/**
 * The plan stage on its own: one Claude call, no renderers, no images.
 *
 * Split out for Populate (#714), which wants the plan and nothing else. The
 * Generate path calls it after it has validated every selected renderer, so
 * the ordering guarantee -- never spend on the writer for a model that cannot
 * take the references -- is the caller's rather than this function's.
 */
export async function runStoryboardPlan(
  data: {
    brief: string
    referenceIds: Array<string>
    systemInstructions?: string
  },
  userId: string,
  count: number | null,
) {
  const rows = data.referenceIds.length
    ? await sql<Array<{ id: string; storage_path: string | null }>>`
    select id, storage_path from user_images
    where id in ${sql(data.referenceIds)} and user_id = ${userId} and deleted_at is null
  `
    : []
  const paths = new Map(rows.map((r) => [r.id, r.storage_path]))
  const content: Array<ImagePart | TextPart> = []
  // Number and load in the user's order, never in database return order.
  for (const [index, id] of data.referenceIds.entries()) {
    const path = paths.get(id)
    const vision = path ? await loadVisionImage(path) : null
    if (!vision)
      throw new Error(
        `Storyboard reference image ${index + 1} is unavailable or unreadable. Re-attach it before generating.`,
      )
    content.push(
      { type: 'text', text: `Image ${index + 1}` },
      { type: 'image', image: vision.data, mediaType: vision.mediaType },
    )
  }
  content.push({
    type: 'text',
    text: JSON.stringify({
      brief: data.brief.replace(/(?:^|\s)--shots(?:=|\s+)\S+/gi, '').trim(),
      // Absent unless the user pinned one. Its absence is the instruction to
      // decide the count from the brief.
      ...(count == null ? {} : { requestedShotCount: count }),
      shotCountRange: { min: 2, max: 9 },
      referenceCount: data.referenceIds.length,
      allowedAspectRatios: STORYBOARD_ASPECT_RATIOS,
      ...(data.systemInstructions
        ? { userPreferences: data.systemInstructions }
        : {}),
    }),
  })
  const { default: system } = await import('#/lib/prompts/storyboard/plan.md')
  const started = Date.now()
  const { output, usage } = await generateText({
    model: ai.reasoning,
    // Anthropic's native output_format rejects maxItems; the SDK's JSON tool
    // accepts the full schema and still validates the resulting object.
    providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
    system,
    output: Output.object({
      schema: storyboardPlanSchema.extend({
        references: storyboardPlanSchema.shape.references.length(
          data.referenceIds.length,
        ),
        ...(count == null
          ? {}
          : { shots: storyboardPlanSchema.shape.shots.length(count) }),
      }),
    }),
    messages: [{ role: 'user', content }],
  })
  const plan = validateStoryboardPlan(
    output,
    data.referenceIds.length,
    count ?? undefined,
  )
  return {
    plan,
    preparation: {
      model: ai.reasoning.modelId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      durationMs: Date.now() - started,
    },
  }
}

async function prepareStoryboard(
  data: z.infer<typeof requestSchema> & { originalInput: string },
  userId: string,
) {
  const invocation = parsePromptInvocation(data.originalInput)
  if (invocation.kind !== 'skill' || invocation.brief !== data.brief)
    throw new Error('The storyboard brief changed. Submit it again.')
  const count = storyboardShotCount(data.brief)
  const models = [
    ...new Set(
      data.models.map((m) => endpointFor(m, data.referenceIds.length > 0)),
    ),
  ]
  validateSkillReferences(models, data.referenceIds)
  requireAiRole('reasoning')
  // Resolve every renderer before spending on the writer. Strict schema lookup
  // must not inherit ordinary generation's optimistic fallback on network failure.
  //
  // The schemas are kept rather than turned straight into layouts, because the
  // layout now depends on the ratio the plan chooses (#714) and the plan has
  // not run yet. Validating the renderers first still fails fast on a model
  // that cannot take the references, before any Claude spend.
  const schemas = await Promise.all(
    models.map(async (model) => {
      const schema = await fetchModelSchema(model, { strict: true })
      if (
        data.referenceIds.length &&
        (!schema.imageInputParam ||
          (schema.imageInputParam === 'image_url' &&
            data.referenceIds.length > 1))
      )
        throw new Error(
          'This model cannot accept all storyboard references. Choose another model.',
        )
      return schema
    }),
  )
  const { plan, preparation } = await runStoryboardPlan(data, userId, count)
  // Now the ratio is known, so each renderer gets a canvas aimed at it.
  const layouts = schemas.map((schema) =>
    layoutForSchema(schema, plan.shotAspectRatio),
  )
  const preparationId = randomUUID()
  return Promise.all(
    models.flatMap((model, index) =>
      plan.shots.map(async (shot) => {
        const skill: PreparedImageSkill = {
          id: 'storyboard',
          version: IMAGE_SKILLS[0].version,
          shotNumber: shot.number,
          preparationId,
          originalInput: data.originalInput,
          brief: data.brief,
          referenceIds: data.referenceIds,
          plan,
          model,
          layout: layouts[index],
          preparation,
        }
        return { skill, prompt: await assembleStoryboardPrompt(skill) }
      }),
    ),
  )
}

export async function assembleStoryboardPrompt(
  skill: PreparedImageSkill,
): Promise<string> {
  const shot = skill.plan.shots.find((s) => s.number === skill.shotNumber)
  if (!shot)
    throw new Error('The selected storyboard shot is missing. Generate again.')
  const { default: instruction } =
    await import('#/lib/prompts/storyboard/render-shot.md')
  return `${instruction.trim()}\n\n${JSON.stringify(
    {
      brief: skill.brief.replace(/(?:^|\s)--shots(?:=|\s+)\S+/gi, '').trim(),
      aspectRatio: skill.layout.sheetAspectRatio,
      continuity: skill.plan.continuity,
      references: skill.plan.references,
      shot,
    },
    null,
    2,
  )}`
}

/** Revalidate the preparation crossing the action boundary before reserving a render. */
export async function validatePreparedSkill(
  skill: PreparedImageSkill,
  model: string,
  referenceIds: Array<string>,
  typedPrompt: string,
) {
  if (
    !z.object({ id: z.literal('storyboard') }).safeParse(skill).success ||
    skill.version !== IMAGE_SKILLS[0].version ||
    skill.originalInput !== typedPrompt ||
    skill.model !== endpointFor(model, referenceIds.length > 0) ||
    JSON.stringify(skill.referenceIds) !== JSON.stringify(referenceIds)
  )
    throw new Error(
      'The prepared storyboard no longer matches the request. Generate again.',
    )
  const invocation = parsePromptInvocation(typedPrompt)
  if (invocation.kind !== 'skill' || invocation.brief !== skill.brief)
    throw new Error('Invalid storyboard invocation. Generate again.')
  validateStoryboardPlan(
    skill.plan,
    referenceIds.length,
    invocation.shots ?? undefined,
  )
  if (
    !Number.isInteger(skill.shotNumber) ||
    !skill.plan.shots.some((s) => s.number === skill.shotNumber)
  )
    throw new Error('Invalid storyboard shot. Generate again.')
  validateSkillReferences([model], referenceIds)
  const layout = await resolveStoryboardLayout(
    skill.model,
    skill.plan.shotAspectRatio,
  )
  if (JSON.stringify(layout) !== JSON.stringify(skill.layout))
    throw new Error(
      'Storyboard dimensions changed. Generate again to prepare the new layout.',
    )
  return assembleStoryboardPrompt(skill)
}
