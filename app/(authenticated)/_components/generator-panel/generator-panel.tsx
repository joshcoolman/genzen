'use client'

import { useState } from 'react'
import { PromptList } from '../prompt-list/prompt-list'
import { SystemInstructionsButton } from '../system-instructions-button/system-instructions-button'
import { ExistingImagePicker } from '../existing-image-picker/existing-image-picker'
import { ModelSelector } from '../model-selector/model-selector'
import styles from './generator-panel.module.css'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { UserImage } from '#/features/user-images/types'
import type { useDescribeJson } from '#/features/ai-images/hooks/use-describe-json'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import {
  ActionButton,
  AspectRatioSelect,
  ImageSourceButtons,
  LibraryPickerDialog,
  NumberStepper,
  RefImageStrip,
  SourceImagePreview,
} from '#/components'
import { cx } from '#/lib/utils'

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
  describe?: ReturnType<typeof useDescribeJson>
  mode?: 'generate' | 'edit'
  modelDisplay?: 'panel' | 'dropdown'
  refImagesReadOnly?: boolean
  libraryFilterIds?: Set<string>
  /**
   * Canvas simplifications (default off = Images behavior unchanged). On
   * canvas the input is the selected image, so the library/upload source
   * buttons and the bulk-prompt controls are removed.
   */
  hideSourceButtons?: boolean
  hidePastePrompts?: boolean
  hideGeneratePrompts?: boolean
}

export function GeneratorPanel({
  generator,
  modelSelector,
  userImages,
  describe,
  mode = 'generate',
  modelDisplay = 'panel',
  refImagesReadOnly = false,
  libraryFilterIds,
  hideSourceButtons = false,
  hidePastePrompts = false,
  hideGeneratePrompts = false,
}: GeneratorPanelProps) {
  const isEdit = mode === 'edit'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)

  // Filter library images to exclude ones already in the chain
  const filteredLibraryImages = libraryFilterIds
    ? userImages.images.filter((img) => !libraryFilterIds.has(img.id))
    : userImages.images

  return (
    <div className={styles.root}>
      {/* Row 1: Source image. The chip is the only indication of what the
          generator is pointed at and the only way to change it (#284) -- the
          grid stopped marking it. Clicking anywhere but the X opens the
          library; the X clears it, and Upload is right below. Canvas is the
          exception: there the source is whatever is selected on the canvas, so
          there is no library to pick from. */}
      {generator.sourceImage && (
        <>
          <SourceImagePreview
            src={generator.sourceImage.base64}
            name={generator.sourceImage.name}
            onRemove={isEdit ? undefined : generator.handleClearSourceImage}
            onPick={
              isEdit || hideSourceButtons
                ? undefined
                : () => {
                    void userImages.refresh()
                    setSourcePickerOpen(true)
                  }
            }
            variant={isEdit ? 'square' : 'compact'}
          />
          <LibraryPickerDialog
            open={sourcePickerOpen}
            onOpenChange={setSourcePickerOpen}
            images={filteredLibraryImages}
            imageUrls={userImages.imageUrls}
            isLoading={userImages.isLoading}
            currentId={generator.sourceImage.id}
            /* Swapping the source keeps the prompt (#205's rule, inherited
               from the grid click this replaced) -- you are changing what the
               sentence you are writing applies to. The library *button* below
               still clears, because that is starting over. */
            onSelect={(image) =>
              generator.setSourceFromLibrary(image.id, image.url, image.title)
            }
          />
        </>
      )}

      {/* Image source buttons + aspect ratio */}
      <div className={cx(styles.row, styles.rowAbovePrompts)}>
        {!hideSourceButtons && (
          <ImageSourceButtons
            onFileSelected={generator.setSourceFile}
            showPaste={false}
            multiple={isEdit}
            library={{
              images: filteredLibraryImages,
              imageUrls: userImages.imageUrls,
              isLoading: userImages.isLoading,
              onSelect: (image) =>
                generator.setSourceFromUrl(image.url, image.title, image.id),
              onSelectMultiple:
                isEdit && generator.setSourceFromUrls
                  ? (images) => generator.setSourceFromUrls?.(images)
                  : undefined,
              onOpen: userImages.refresh,
            }}
            className={styles.contents}
          />
        )}
        <AspectRatioSelect
          orientation={generator.orientation}
          aspectRatio={generator.aspectRatio}
          onOrientationChange={generator.setOrientation}
          onAspectRatioChange={generator.setAspectRatio}
          disabled={generator.loading}
          className={isEdit || hideSourceButtons ? styles.fill : undefined}
        />
      </div>

      {/* Prompt textareas */}
      <PromptList
        prompts={generator.prompts}
        onUpdatePrompt={generator.setPromptAtIndex}
        onAddPrompt={generator.addPrompt}
        onRemovePrompt={generator.removePrompt}
        disabled={generator.loading || generator.describingImage}
        placeholders={{
          first: generator.describingImage
            ? 'Describing image...'
            : isEdit
              ? 'Describe the edit...'
              : generator.sourceImage
                ? 'Edit prompt (optional)...'
                : 'Describe your image...',
          additional: 'Additional prompt...',
        }}
        generatePromptsConfig={
          hideGeneratePrompts
            ? undefined
            : (generator.generatePromptsConfig ?? undefined)
        }
        onClearPrompts={generator.clearPrompts}
        onPastePrompts={hidePastePrompts ? undefined : generator.pastePrompts}
        onEnhancePrompt={generator.handleEnhancePrompt}
        enhancingPromptIndex={generator.enhancingPromptIndex}
        /* Instructions for every prompt, not a prompt -- rendered into the
           list's header strip from here so PromptList never learns about them
           (#272), and so both Images and Canvas get the control. */
        headerSlot={<SystemInstructionsButton />}
      />

      {/* Ref images -- show when model supports refs */}
      {generator.maxRefImages > 0 && (
        <>
          <RefImageStrip
            images={generator.refImages}
            max={generator.maxRefImages}
            onAdd={
              refImagesReadOnly
                ? undefined
                : () => {
                    userImages.refresh()
                    setPickerOpen(true)
                  }
            }
            onRemove={refImagesReadOnly ? undefined : generator.removeRefImage}
            onClear={
              refImagesReadOnly
                ? undefined
                : () => generator.replaceRefImages([])
            }
            disabled={generator.loading}
          />
          <ExistingImagePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            images={userImages.images}
            imageUrls={userImages.imageUrls}
            isLoading={userImages.isLoading}
            alreadyCollectedIds={new Set(generator.refImages.map((r) => r.id))}
            onConfirm={(selected) =>
              generator.addRefImages(
                selected.map((s) => ({
                  id: s.id,
                  url: s.url,
                  title: s.title,
                })),
              )
            }
            max={generator.maxRefImages - generator.refImages.length}
          />
        </>
      )}

      {/* Generate button + gens stepper */}
      <div className={styles.row}>
        <ActionButton
          onClick={() => generator.handleGenerate()}
          loading={generator.loading || generator.savingSource}
          loadingText={
            // Saving an attached source blocks Generate (#224). Say so, or the
            // button just looks inert for however long the upload takes.
            generator.savingSource
              ? 'Saving image...'
              : generator.totalImages > 1
                ? `Generating ${generator.totalImages} images...`
                : isEdit
                  ? 'Generating edit...'
                  : 'Generating...'
          }
          disabled={!generator.canGenerate}
          className={styles.fill}
        >
          {isEdit
            ? generator.totalImages > 1
              ? `Generate ${generator.totalImages} edits`
              : 'Generate Edit'
            : generator.totalImages > 1
              ? `Generate ${generator.totalImages} images`
              : 'Generate'}
        </ActionButton>
        <NumberStepper
          value={modelSelector.gensPerModel}
          min={1}
          max={5}
          onAdjust={modelSelector.adjustGens}
          disabled={generator.loading}
        />
      </div>

      {/* Model selector */}
      <ModelSelector
        display={modelDisplay}
        mode="multi"
        persistKey="genzen:model-panel:expanded"
        selectedIds={modelSelector.selectedIds}
        visibleModels={modelSelector.models}
        onToggleSelected={modelSelector.toggleSelected}
      />

      {/* Describe / JSON -- only when source image present */}
      {generator.sourceImage && (
        <div className={styles.row}>
          <ActionButton
            variant="outline"
            onClick={() => void generator.handleCaption()}
            loading={generator.describingImage}
            loadingText="..."
            disabled={generator.loading}
            className={styles.fill}
          >
            Describe
          </ActionButton>
          {describe && (
            <ActionButton
              variant="outline"
              onClick={describe.handleDescribe}
              loading={describe.jsonLoading}
              loadingText="..."
              disabled={generator.loading}
              className={styles.fill}
            >
              JSON
            </ActionButton>
          )}
        </div>
      )}
    </div>
  )
}
