import { imageLabelPrefix } from './ref-images'
import { promptWithReadings, readingBlocks } from './ref-roles'
import { endpointFor, modelTitleFor } from './models'
import { parsePromptInvocation } from './skills/registry'
import { prepareImageSkill } from './server/prepare-image-skill.action'
import { submitGeneratorImage } from './server/submit-generator-image.action'
import type { PromptInvocation } from './skills/registry'
import type { ReferenceReading } from './ref-roles'
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
  /** The pictures the model receives, in strip order. Read roles are not
   *  here -- they arrive as `readings` (#635). */
  referenceIds: Array<string>
  /** What the read roles said, in strip order. Appended to every prompt as
   *  labelled blocks; recorded on the row; never re-read at submit. */
  readings?: Array<ReferenceReading>
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
  const readings = batch.readings ?? []
  const blocks = readingBlocks(readings)
  const active = batch.prompts.filter((p) => p.trim())
  const prompts = active.length ? active : ['']
  // Invalid commands never create a job or make a provider call.
  const invocations = prompts.map(parsePromptInvocation)

  // Promise sharing starts here rather than after the cards, because an
  // unpinned storyboard has no shot count until its plan exists (#714) and the
  // card fan-out is built from that number. One preparation per distinct
  // brief, reused by every call below, so planning early costs no extra Claude.
  const preparations = new Map<string, ReturnType<typeof prepareImageSkill>>()
  const prepare = (
    invocation: Extract<PromptInvocation, { kind: 'skill' }>,
  ) => {
    let preparation = preparations.get(invocation.originalInput)
    if (!preparation) {
      preparation = prepareImageSkill({
        skillId: invocation.skillId,
        // Readings do not reach a storyboard (#635): the server checks
        // this brief against the typed command byte for byte, and the
        // plan takes its look from the references it is handed. Feeding
        // a read role into the plan is its own change.
        brief: invocation.brief,
        originalInput: invocation.originalInput,
        referenceIds: batch.referenceIds,
        models: batch.selectedModels,
        systemInstructions: batch.systemInstructions,
      })
      preparations.set(invocation.originalInput, preparation)
    }
    return preparation
  }

  /**
   * The cards this prompt draws, for a range of shot numbers.
   *
   * Split out because an unpinned storyboard draws its cards in two waves --
   * see below.
   */
  const buildCalls = (invocation: PromptInvocation, from: number, to: number) =>
    batch.selectedModels.flatMap((model) =>
      Array.from({ length: batch.gensPerModel }, () =>
        Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => ({
          placeholderId: optimisticId(),
          model,
          resolved: endpointFor(model, !!sourceImageId),
          invocation,
          shotNumber: invocation.kind === 'skill' ? from + i : undefined,
          typedPrompt:
            invocation.kind === 'skill'
              ? invocation.originalInput
              : invocation.text,
        })),
      ).flat(),
    )

  type Call = ReturnType<typeof buildCalls>[number]

  const draw = (wave: Array<Call>) => {
    if (!wave.length) return
    batch.onSubmitStart?.(
      wave.map((c) => ({
        placeholderId: c.placeholderId,
        model: c.model,
        title: modelTitleFor(c.resolved),
        ...(c.shotNumber ? { storyboardShot: c.shotNumber } : {}),
        prompt: c.typedPrompt.trim() ? c.typedPrompt : blocks,
        ...(sourceImageId ? { sourceImageId } : {}),
        ...(referenceImageIds.length ? { referenceImageIds } : {}),
      })),
    )
  }

  /**
   * A pinned count and a plain prompt both answer without a round trip. An
   * unpinned storyboard does not: the plan decides how many images the brief
   * wants (#714), and until Claude answers there is no number to fan out on.
   *
   * **Draw shot 1 anyway, before asking.** The first shape of this waited for
   * the plan and drew every card at once, which left ~35 seconds after the
   * click with nothing whatsoever on screen -- `handleGenerate` sets no
   * loading state, because the composer stays usable during background work,
   * so the optimistic cards were the *only* signal a run was in flight.
   * During that silence a real run was lost: the wall looked idle, the
   * previous batch was tidied away, and it contained the image staged as the
   * reference, so all nine shots failed with "Source image not found".
   *
   * So the click always draws something, and the rest of the set joins it
   * when the plan lands. `onSubmitStart` appends, which is what makes two
   * waves possible without the gallery learning anything new.
   */
  const pinned = (invocation: PromptInvocation) =>
    invocation.kind === 'skill' ? invocation.shots : 1

  const firstWave = invocations.flatMap((invocation) =>
    buildCalls(invocation, 1, pinned(invocation) ?? 1),
  )
  draw(firstWave)

  // Nothing unpinned means the whole fan-out was built in the same
  // synchronous turn as the click, exactly as it always was -- so this must
  // not await when every count is already known.
  const needsPlan = invocations.some((i) => pinned(i) == null)
  const laterWave = !needsPlan
    ? []
    : (
        await Promise.all(
          invocations.map(async (invocation) => {
            if (pinned(invocation) != null) return []
            const variants = await prepare(
              invocation as Extract<PromptInvocation, { kind: 'skill' }>,
            )
            const planned = variants[0]?.skill.plan.shots.length ?? 1
            return buildCalls(invocation, 2, planned)
          }),
        )
      ).flat()
  draw(laterWave)

  const calls = [...firstWave, ...laterWave]

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
          variant = (await prepare(invocation)).find(
            (v) =>
              v.skill.model === c.resolved &&
              v.skill.shotNumber === c.shotNumber,
          )
          if (!variant)
            throw new Error(
              'Storyboard preparation is missing for a selected model. Try again.',
            )
        }
        // The blocks go under the typed words, after the image labels, which
        // count only the pictures actually sent (#635). Nothing typed and
        // something read is a prompt made of the blocks alone.
        const prompt =
          variant?.prompt ??
          `${batch.systemInstructions}${imageLabelPrefix(batch.referenceIds.length)}${promptWithReadings(c.typedPrompt, readings)}`
        // What the card calls the prompt. The blocks stand in when nothing was
        // typed: a caption of nothing on a picture made from two readings would
        // say the generation had no prompt, and it had one.
        const shownPrompt = c.typedPrompt.trim() ? c.typedPrompt : blocks
        const result = await submitGeneratorImage({
          origin: batch.origin,
          prompt,
          ...(shownPrompt !== prompt ? { typedPrompt: shownPrompt } : {}),
          ...(readings.length ? { readings } : {}),
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
