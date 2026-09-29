'use client'

import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { useConfirm } from '#/components'
import { formatCents } from '#/lib/format'

/**
 * Above this many images in one submit, Generate asks first.
 *
 * The count is prompts x models x gens, so it multiplies out of sight -- three
 * prompts and two models is six generations from a panel that shows a "1" in
 * the stepper. Five is low enough to catch that and high enough that a normal
 * run never sees the dialog.
 */
const CONFIRM_ABOVE = 5

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * The Generate press, shared by the panel and the phone's composer (#753) so
 * the two cannot disagree about when a run is big enough to ask.
 *
 * A big run says how big before it starts. Cancel returns without submitting
 * anything, so the model selection and the count are still there to adjust --
 * the alternative was noticing twenty cards after they had already been paid
 * for, since nothing here is refundable once FAL has the job.
 *
 * Not `destructive`: generating is not destruction, and the red confirm button
 * is reserved for things that lose work. Render `dialogProps` into a
 * `ConfirmDialog`.
 */
export function useGenerateClick({
  generator,
  modelSelector,
  onSubmit,
}: {
  generator: GeneratorState
  modelSelector: ReturnType<typeof useModelSelector>
  /** Past the confirm, about to submit. */
  onSubmit?: () => void
}) {
  const { confirm, dialogProps } = useConfirm()

  async function generate() {
    const count = generator.totalImages
    if (count > CONFIRM_ABOVE) {
      const models = modelSelector.selectedIds.length
      // The multiplication spelled out, because the surprise is never the
      // number itself -- it is which of the three factors was larger than you
      // remembered.
      const ok = await confirm({
        title: `Generate ${count} images?`,
        message: `${plural(count, 'image')} across ${plural(models, 'model')} (including every storyboard shot), about ${formatCents(generator.estimatedCost.cents)}. Cancel to change the count or the models.`,
        confirmLabel: `Generate ${count}`,
        destructive: false,
      })
      if (!ok) return
    }
    onSubmit?.()
    await generator.handleGenerate()
  }

  return { generate, dialogProps, confirm }
}
