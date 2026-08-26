'use client'

import { useState } from 'react'
import { PromptList } from '../prompt-list/prompt-list'
import { GeneratePromptButton } from '../generate-prompt-dialog/generate-prompt-dialog'
import { ExistingImagePicker } from '../existing-image-picker/existing-image-picker'
import { ModelSelector } from '../model-selector/model-selector'
import styles from './generator-panel.module.css'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { UserImage } from '#/features/user-images/types'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { pricedForImages } from '#/features/ai-images/model-selector/unified-models'
import { formatCents } from '#/lib/format'
import {
  ActionButton,
  AspectRatioSelect,
  ConfirmDialog,
  CostNote,
  NumberStepper,
  RefImageStrip,
  useConfirm,
} from '#/components'

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

interface UserImagesData {
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  refresh: () => Promise<void>
}

interface GeneratorPanelProps {
  generator: GeneratorState
  modelSelector: ReturnType<typeof useModelSelector>
  userImages: UserImagesData
  modelDisplay?: 'panel' | 'dropdown'
}

/**
 * The panel Images and Canvas both generate from.
 *
 * There is no source image (#297). There is an ordered set of zero to N
 * reference images and one widget that fills it, and its way in is the library
 * picker -- which uploads as well as picks since #489, so a file on disk no
 * longer means a trip to the Images toolbar and back. The row of source buttons
 * that used to sit above the prompt is gone, along with the chip, the
 * Describe/JSON pair and five separate ways to put an image in two different
 * state slots.
 */
export function GeneratorPanel({
  generator,
  modelSelector,
  userImages,
  modelDisplay = 'panel',
}: GeneratorPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { confirm, dialogProps } = useConfirm()

  /**
   * Where a generated prompt lands. Fills the first row while the list is one
   * empty box, appends after that.
   *
   * The special case exists so the common path -- open the panel, roll, apply
   * -- does not leave an empty row above the prompt you just took. Once there
   * is anything to preserve, appending is the only safe move: the dialog stays
   * open to add several, and overwriting on the second Apply would silently
   * eat the first.
   */
  function addGeneratedPrompt(text: string) {
    const untouched =
      generator.prompts.length === 1 && generator.prompts[0].trim() === ''
    if (untouched) generator.setPromptAtIndex(0, text)
    else generator.appendPrompts([text])
  }

  /**
   * A big run says how big before it starts. Cancel returns without submitting
   * anything, so the model selection and the count are still there to adjust --
   * the alternative was noticing twenty cards after they had already been paid
   * for, since nothing here is refundable once FAL has the job.
   *
   * Not `destructive`: generating is not destruction, and the red confirm
   * button is reserved for things that lose work.
   */
  async function handleGenerateClick() {
    const count = generator.totalImages
    if (count > CONFIRM_ABOVE) {
      const prompts = generator.prompts.filter((p) => p.trim()).length || 1
      const models = modelSelector.selectedIds.length
      // The multiplication spelled out, because the surprise is never the
      // number itself -- it is which of the three factors was larger than you
      // remembered.
      const ok = await confirm({
        title: `Generate ${count} images?`,
        message: `${plural(prompts, 'prompt')} x ${plural(models, 'model')} x ${modelSelector.gensPerModel} each, about ${formatCents(generator.estimatedCost.cents)}. Cancel to change the count or the models.`,
        confirmLabel: `Generate ${count}`,
        destructive: false,
      })
      if (!ok) return
    }
    await generator.handleGenerate()
  }

  return (
    <div className={styles.root}>
      {/* Prompt textareas. Nothing above them any more. */}
      <PromptList
        prompts={generator.prompts}
        onUpdatePrompt={generator.setPromptAtIndex}
        onAddPrompt={generator.addPrompt}
        onRemovePrompt={generator.removePrompt}
        disabled={generator.loading}
        placeholders={{
          first: 'Describe your image...',
          additional: 'Additional prompt...',
        }}
        onClearPrompts={generator.clearPrompts}
        /* Filling a prompt is not a prompt, so it is passed in rather than
           built in: PromptList never learns that prompts can be generated.
           Beside Add prompt because both are ways of getting a row filled.
           System instructions are not here at all any more -- they are the
           header's, on all three surfaces that render this panel. */
        actionSlot={
          <GeneratePromptButton
            onAdd={addGeneratedPrompt}
            disabled={generator.loading}
          />
        }
      />

      {/* The set, unbounded (#341). No `max`: what a model can hold is in the
          picker's Refs column, applied at submit, and reported on the card. The
          strip refusing an image was how staged work got deleted by ticking a
          smaller model. It still disables with no model selected at all --
          there is nothing to attach images to. */}
      {/* No "Reference images" heading. The strip is a row of thumbnails and a
          + box directly under the prompt, which is where an image would be
          expected in a generate panel; the label was naming the obvious and
          spending a line of a 20rem column to do it. The picker it opens says
          what it is. */}
      <div className={styles.refs}>
        <RefImageStrip
          images={generator.refImages}
          onAdd={() => {
            void userImages.refresh()
            setPickerOpen(true)
          }}
          onRemove={generator.removeRefImage}
          onClear={() => generator.replaceRefImages([])}
          disabled={generator.loading || generator.maxRefImages === 0}
        />
      </div>
      <ExistingImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        isLoading={userImages.isLoading}
        alreadyCollectedIds={new Set(generator.refImages.map((r) => r.id))}
        /* Turns on the picker's own Upload (#489). The reference you want is
           often a file on disk, and getting it in used to mean leaving this
           dialog for the Images toolbar and coming back. */
        onRefresh={userImages.refresh}
        onConfirm={(selected) =>
          generator.addRefImages(
            selected.map((s) => ({ id: s.id, url: s.url, title: s.title })),
          )
        }
      />

      {/* How many and what shape, then the button. The aspect ratio moved down
          from the dead source row (#297) -- it describes the request, so it
          belongs with the count rather than above the prompt. Two rows rather
          than three-in-one: in a 20rem dock a full-width Generate and a full
          Generate label do not both fit beside these. The label carries the
          count; the price is in the CostNote below it (#416), which is where
          Video puts it too. */}
      <div className={styles.controls}>
        <NumberStepper
          value={modelSelector.gensPerModel}
          min={1}
          max={5}
          onAdjust={modelSelector.adjustGens}
          disabled={generator.loading}
        />
        <AspectRatioSelect
          orientation={generator.orientation}
          aspectRatio={generator.aspectRatio}
          onOrientationChange={generator.setOrientation}
          onAspectRatioChange={generator.setAspectRatio}
          disabled={generator.loading}
          className={styles.fill}
        />
      </div>
      <ActionButton
        onClick={() => void handleGenerateClick()}
        loading={generator.loading}
        loadingText={
          generator.totalImages > 1
            ? `Generating ${generator.totalImages} images...`
            : 'Generating...'
        }
        disabled={!generator.canGenerate}
        className={styles.generate}
      >
        {generator.totalImages > 1
          ? `Generate ${generator.totalImages} images`
          : 'Generate'}
      </ActionButton>

      {/* Images had no cost figure at all until #416 -- on the one route where
          a stepper, a prompt list and multi-select models all multiply, so the
          count reaches double figures from a panel showing "1". */}
      {/* No model name beside the figure: the picker directly below this reads
          "Multiple (8 models)" already, and two lines saying the same thing is
          one line of noise. Video passes a spec because its own carries the
          resolution and whether audio is included, which nothing else says. */}
      <CostNote
        cents={generator.estimatedCost.cents}
        unpriced={generator.estimatedCost.unpriced}
      />

      <ConfirmDialog {...dialogProps} />

      {/* Model selector */}
      <ModelSelector
        display={modelDisplay}
        mode="multi"
        persistKey="genzen:model-panel:expanded"
        selectedIds={modelSelector.selectedIds}
        // Priced for the endpoint this click will hit, so the column and the
        // estimate above it cannot disagree (#304).
        visibleModels={pricedForImages(
          modelSelector.models,
          generator.refImages.length > 0,
        )}
        stagedImageCount={generator.refImages.length}
        onToggleSelected={modelSelector.toggleSelected}
        onToggleAll={modelSelector.toggleAll}
        onSelectOnly={(id) => modelSelector.selectOnly([id])}
      />
    </div>
  )
}
