import { imageLabelPrefix } from './ref-images'
import { endpointFor, modelTitleFor } from './models'
import { parsePromptInvocation } from './skills/registry'
import { prepareImageSkill } from './server/prepare-image-skill.action'
import { submitGeneratorImage } from './server/submit-generator-image.action'
import type { GenerationOrigin } from '#/lib/types/db'
import { optimisticId } from '#/lib/optimistic-id'

export interface GenerationCallbacks {
  // Ordered per-call outcomes (one per submitted generation, in submit order),
  // so callers can map each result to its placeholder and attribute failures.
  // `model` is the user-facing base id; `recordId` is null when the submit
  // itself failed (no DB record), with `error` carrying the reason.
  onAfterSubmit?: (
    results: Array<{
      model: string
      placeholderId: string
      recordId: string | null
      error: string | null
    }>,
  ) => void
  /**
   * Fires **before any request**, one entry per generation about to be
   * submitted, in submit order (#313).
   *
   * Storyboard planning can take tens of seconds before a render row exists.
   * The host already has the model and prompt at click time, so it draws a
   * card immediately and reconciles it when that call settles.
   */
  onSubmitStart?: (
    placeholders: Array<{
      placeholderId: string
      model: string
      /** The row's eventual title, resolved here rather than by the host: it
       *  comes from the endpoint the submit will use, which only this hook has
       *  worked out. Same function the reserve and the completion call, so the
       *  badge cannot change when the card becomes real (#367). */
      title: string
      prompt: string
      sourceImageId?: string
      referenceImageIds?: Array<string>
      storyboardShot?: number
    }>,
  ) => void
  /**
   * Fires as each generation settles, rather than after all of them. One slow
   * model no longer holds up the rest -- which is the whole reason the calls
   * are fired together in the first place.
   */
  onSubmitOutcome?: (outcome: {
    placeholderId: string
    model: string
    recordId: string | null
    error: string | null
  }) => void
}

interface GenerationBatch extends GenerationCallbacks {
  prompts: Array<string>
  referenceIds: Array<string>
  selectedModels: Array<string>
  gensPerModel: number
  aspectRatio: string
  systemInstructions: string
  selectedStyleId: string | null
  origin: GenerationOrigin
  canvasId?: string
  groupId?: string | null
}

/** Capture a click before starting work. Each batch owns its plans and ids;
 * later edits and submissions cannot change or block it. */
export async function submitGenerationBatch(batch: GenerationBatch) {
  const [sourceImageId, ...referenceImageIds] = batch.referenceIds
  const active = batch.prompts.filter((p) => p.trim())
  const prompts = active.length ? active : ['']
  // Invalid commands never create a job or make a provider call.
  const invocations = prompts.map(parsePromptInvocation)
  const calls = invocations.flatMap((invocation) =>
    batch.selectedModels.flatMap((model) =>
      Array.from({ length: batch.gensPerModel }, () =>
        Array.from(
          { length: invocation.kind === 'skill' ? invocation.shots : 1 },
          (_, shotIndex) => ({
            placeholderId: optimisticId(),
            model,
            resolved: endpointFor(model, !!sourceImageId),
            invocation,
            shotNumber: invocation.kind === 'skill' ? shotIndex + 1 : undefined,
            typedPrompt:
              invocation.kind === 'skill'
                ? invocation.originalInput
                : invocation.text,
          }),
        ),
      ).flat(),
    ),
  )
  batch.onSubmitStart?.(
    calls.map((c) => ({
      placeholderId: c.placeholderId,
      model: c.model,
      title: modelTitleFor(c.resolved),
      ...(c.shotNumber ? { storyboardShot: c.shotNumber } : {}),
      prompt: c.typedPrompt,
      ...(sourceImageId ? { sourceImageId } : {}),
      ...(referenceImageIds.length ? { referenceImageIds } : {}),
    })),
  )

  // Promise sharing starts after the cards exist. A slow storyboard does not
  // hold up ordinary prompts, other briefs, or a later click on Generate.
  const preparations = new Map<string, ReturnType<typeof prepareImageSkill>>()
  const outcomes = await Promise.all(
    calls.map(async (c) => {
      let recordId: string | null = null
      let error: string | null = null
      try {
        let variant:
          | Awaited<ReturnType<typeof prepareImageSkill>>[number]
          | undefined
        if (c.invocation.kind === 'skill') {
          const invocation = c.invocation
          let preparation = preparations.get(invocation.originalInput)
          if (!preparation) {
            preparation = prepareImageSkill({
              skillId: invocation.skillId,
              brief: invocation.brief,
              originalInput: invocation.originalInput,
              referenceIds: batch.referenceIds,
              models: batch.selectedModels,
              systemInstructions: batch.systemInstructions,
            })
            preparations.set(invocation.originalInput, preparation)
          }
          variant = (await preparation).find(
            (v) =>
              v.skill.model === c.resolved &&
              v.skill.shotNumber === c.shotNumber,
          )
          if (!variant)
            throw new Error(
              'Storyboard preparation is missing for a selected model. Try again.',
            )
        }
        const prompt =
          variant?.prompt ??
          `${batch.systemInstructions}${imageLabelPrefix(batch.referenceIds.length)}${c.typedPrompt}`
        const result = await submitGeneratorImage({
          origin: batch.origin,
          prompt,
          ...(c.typedPrompt !== prompt ? { typedPrompt: c.typedPrompt } : {}),
          model: c.resolved,
          aspectRatio:
            variant?.skill.layout.sheetAspectRatio ?? batch.aspectRatio,
          ...(variant ? { skill: variant.skill } : {}),
          idempotencyKey: crypto.randomUUID(),
          ...(sourceImageId ? { sourceImageId } : {}),
          ...(referenceImageIds.length ? { referenceImageIds } : {}),
          ...(batch.selectedStyleId ? { styleId: batch.selectedStyleId } : {}),
          ...(batch.canvasId ? { canvasId: batch.canvasId } : {}),
          ...(batch.groupId ? { groupId: batch.groupId } : {}),
        })
        recordId = result.recordId
        error = result.error
      } catch (reason) {
        error = reason instanceof Error ? reason.message : String(reason)
      }
      const outcome = {
        placeholderId: c.placeholderId,
        model: c.model,
        recordId,
        error,
      }
      batch.onSubmitOutcome?.(outcome)
      return outcome
    }),
  )
  batch.onAfterSubmit?.(outcomes)
  const failure = outcomes.find((o) => o.error)
  if (failure) throw new Error(failure.error!)
}
