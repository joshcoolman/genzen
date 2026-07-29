'use client'

import { useState } from 'react'
import { PromptList } from '../prompt-list/prompt-list'
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
  NumberStepper,
  RefImageStrip,
  SourceImagePreview,
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

  // Filter library images to exclude ones already in the chain
  const filteredLibraryImages = libraryFilterIds
    ? userImages.images.filter((img) => !libraryFilterIds.has(img.id))
    : userImages.images

  return (
    <div className={styles.root}>
      {/* Row 1: Source image */}
      {generator.sourceImage && (
        <SourceImagePreview
          src={generator.sourceImage.base64}
          name={generator.sourceImage.name}
          onRemove={isEdit ? undefined : generator.handleClearSourceImage}
          variant={isEdit ? 'square' : 'compact'}
        />
      )}

      {/* Image source buttons + aspect ratio */}
      <div className={styles.row}>
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
                generator.setSourceFromUrl(image.url, image.title),
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
        onClear={generator.handleClear}
        canClear={
          !!(
            generator.prompt ||
            generator.sourceImage ||
            generator.refImages.length > 0
          )
        }
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
          loading={generator.loading}
          loadingText={
            generator.totalImages > 1
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
