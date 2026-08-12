'use client'

import { useState } from 'react'
import { PromptList } from '../prompt-list/prompt-list'
import { SystemInstructionsButton } from '../system-instructions-button/system-instructions-button'
import { ExistingImagePicker } from '../existing-image-picker/existing-image-picker'
import { ModelSelector } from '../model-selector/model-selector'
import styles from './generator-panel.module.css'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { UserImage } from '#/features/user-images/types'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import {
  ActionButton,
  AspectRatioSelect,
  NumberStepper,
  RefImageStrip,
} from '#/components'

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
 * reference images and one widget that fills it, and the widget's only way in
 * is the library -- uploading is the Images toolbar's job and nowhere else's.
 * The row of source buttons that used to sit above the prompt is gone with it,
 * along with the chip, the Describe/JSON pair and five separate ways to put an
 * image in two different state slots.
 */
export function GeneratorPanel({
  generator,
  modelSelector,
  userImages,
  modelDisplay = 'panel',
}: GeneratorPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const remaining = generator.maxRefImages - generator.refImages.length

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
        onEnhancePrompt={generator.handleEnhancePrompt}
        enhancingPromptIndex={generator.enhancingPromptIndex}
        /* Instructions for every prompt, not a prompt -- rendered into the
           list's header strip from here so PromptList never learns about them
           (#272), and so both Images and Canvas get the control. */
        headerSlot={<SystemInstructionsButton />}
      />

      {/* The set. It never hides: every model in the lineup takes at least one
          image, so a widget that appeared and vanished as the selection changed
          was churn with no information in it. A model with no image input at
          all would leave `maxRefImages` at 0, which disables the strip rather
          than offering slots the submit would drop. */}
      <div className={styles.refs}>
        <p className={styles.refsLabel}>Reference images</p>
        <RefImageStrip
          images={generator.refImages}
          max={generator.maxRefImages}
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
        onConfirm={(selected) =>
          generator.addRefImages(
            selected.map((s) => ({ id: s.id, url: s.url, title: s.title })),
          )
        }
        max={remaining > 0 ? remaining : 0}
      />

      {/* How many and what shape, then the button. The aspect ratio moved down
          from the dead source row (#297) -- it describes the request, so it
          belongs with the count rather than above the prompt. Two rows rather
          than three-in-one: in a 20rem dock a full-width Generate and a full
          Generate label do not both fit beside these, and the label carries the
          only warning that a click is about to cost double. */}
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
        onClick={() => generator.handleGenerate()}
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

      {/* Model selector */}
      <ModelSelector
        display={modelDisplay}
        mode="multi"
        persistKey="genzen:model-panel:expanded"
        selectedIds={modelSelector.selectedIds}
        visibleModels={modelSelector.models}
        onToggleSelected={modelSelector.toggleSelected}
      />
    </div>
  )
}
