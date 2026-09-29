'use client'

import { useState } from 'react'
import { ImagePlus, Plus, X } from 'lucide-react'
import {
  Chip,
  ChipLabel,
  ChipRow,
  ChipStack,
  ComposerBody,
  ComposerHeader,
  ComposerNote,
  ComposerPrompt,
  ComposerRoot,
  DoneFooter,
  NoteAction,
  PrimaryAction,
  Tile,
  TileGrid,
} from '../../../_components/mobile-composer/mobile-composer'
import { ExistingImagePicker } from '../../../_components/existing-image-picker/existing-image-picker'
import { ModelTable } from '../../../_components/model-selector/model-selector'
import { SystemInstructionsButton } from '../../../_components/system-instructions-button/system-instructions-button'
import { useGenerateClick } from '../../../_components/generator-panel/use-generate-click'
import styles from './mobile-generator.module.css'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import type { RefRole } from '#/features/ai-images/ref-roles'
import type { UserImage } from '#/features/user-images/types'
import { pricedForImages } from '#/features/ai-images/model-selector/unified-models'
import { REF_ROLES, isReadRole } from '#/features/ai-images/ref-roles'
import { ALL_RATIOS, ConfirmDialog, RatioIcon } from '#/components'
import { formatCents } from '#/lib/format'

/** `adjustGens` clamps to this; the tiles offer every value it allows. */
const COUNTS = [1, 2, 3, 4, 5]

type Step = 'compose' | 'models' | 'refs' | 'aspect' | 'count'

const TITLES: Record<Step, string> = {
  compose: 'Generate',
  models: 'Models',
  refs: 'Reference images',
  aspect: 'Aspect ratio',
  count: 'How many',
}

interface MobileGeneratorProps {
  generator: GeneratorState
  modelSelector: ReturnType<typeof useModelSelector>
  userImages: {
    images: Array<UserImage>
    imageUrls: Record<string, string>
    isLoading: boolean
    refresh: () => Promise<void>
  }
  uploadGroupId?: string | null
  onClose: () => void
  /** Past the size confirm, about to submit. The sheet closes on it. */
  onSubmit: () => void
}

/**
 * The generator on a phone (#753): one prompt, one row of chips, one big
 * Generate -- and each chip opens a step of its own in the same sheet.
 *
 * **A single choice returns on tap; a multiple choice has Done.** Aspect and
 * count are one tap and straight back, which is what makes the thing
 * thumb-fast. Models and references can take several, so they wait to be
 * told.
 *
 * Deliberately less than the desktop panel. Add prompt, Generate prompt,
 * slash commands and Shots are not here: the phone is
 * for a quick run, and every one of them is still on desktop. A prompt list
 * that arrives with several rows (loaded there) is said, not hidden, because
 * Generate runs all of them.
 */
export function MobileGenerator({
  generator,
  modelSelector,
  userImages,
  uploadGroupId,
  onClose,
  onSubmit,
}: MobileGeneratorProps) {
  const [step, setStep] = useState<Step>('compose')
  const [pickerOpen, setPickerOpen] = useState(false)
  const { generate, dialogProps } = useGenerateClick({
    generator,
    modelSelector,
    onSubmit,
  })

  const models = pricedForImages(
    modelSelector.models,
    generator.refImages.length > 0,
  )
  const selectedModels = models.filter((m) =>
    modelSelector.selectedIds.includes(m.id),
  )
  const modelsLabel =
    selectedModels.length === 0
      ? 'Models'
      : selectedModels.length === 1
        ? selectedModels[0].name
        : `${selectedModels.length} models`

  const ratio =
    ALL_RATIOS.find((r) => r.label === generator.aspectRatio) ?? ALL_RATIOS[0]
  const extraPrompts = generator.prompts.length - 1
  const busy = generator.loading

  const back = () => setStep('compose')

  const openPicker = () => {
    void userImages.refresh()
    setPickerOpen(true)
  }

  return (
    <ComposerRoot>
      <ComposerHeader
        title={TITLES[step]}
        onBack={step === 'compose' ? undefined : back}
        onClose={onClose}
        /* The gear rides every surface that generates -- a prompt prefix
           applying with nothing on screen saying so is the failure it guards
           (see images/CLAUDE.md). */
        action={step === 'compose' ? <SystemInstructionsButton /> : undefined}
      />

      {step === 'compose' && (
        <ComposerBody>
          <ComposerPrompt
            value={generator.prompts[0] ?? ''}
            onChange={(e) => generator.setPromptAtIndex(0, e.target.value)}
            placeholder="Describe your image..."
            disabled={busy}
          />
          {extraPrompts > 0 && (
            <ComposerNote
              action={
                <NoteAction
                  onClick={() => {
                    for (let i = generator.prompts.length - 1; i > 0; i--)
                      generator.removePrompt(i)
                  }}
                >
                  Remove
                </NoteAction>
              }
            >
              {`+${extraPrompts} more prompt${extraPrompts === 1 ? '' : 's'} will also run.`}
            </ComposerNote>
          )}

          <ChipRow>
            <Chip wide onClick={() => setStep('models')}>
              <ChipLabel>{modelsLabel}</ChipLabel>
            </Chip>
            <Chip
              onClick={() =>
                generator.refImages.length > 0 ? setStep('refs') : openPicker()
              }
              aria-label="Reference images"
            >
              {generator.refImages.length > 0 ? (
                <ChipStack
                  urls={generator.refImages.map((img) => img.url)}
                  count={generator.refImages.length}
                />
              ) : (
                <ImagePlus />
              )}
            </Chip>
            <Chip onClick={() => setStep('aspect')} disabled={busy}>
              <RatioIcon w={ratio.w} h={ratio.h} />
              {ratio.label}
            </Chip>
            <Chip onClick={() => setStep('count')} disabled={busy}>
              {`×${modelSelector.gensPerModel}`}
            </Chip>
          </ChipRow>

          <PrimaryAction
            onClick={() => void generate()}
            loading={busy}
            loadingText=""
            disabled={!generator.canGenerate}
            cost={
              generator.estimatedCost.cents > 0
                ? formatCents(generator.estimatedCost.cents)
                : null
            }
          >
            {generator.totalImages > 1
              ? `Generate ${generator.totalImages}`
              : 'Generate'}
          </PrimaryAction>
        </ComposerBody>
      )}

      {step === 'models' && (
        <>
          <ComposerBody scroll>
            <ModelTable
              models={models}
              selectedIds={modelSelector.selectedIds}
              stagedImageCount={generator.refImages.length}
              onToggle={modelSelector.toggleSelected}
              onToggleAll={modelSelector.toggleAll}
              onSelectOnly={(id) => modelSelector.selectOnly([id])}
            />
          </ComposerBody>
          <DoneFooter onClick={back} />
        </>
      )}

      {step === 'refs' && (
        <>
          <ComposerBody scroll>
            <button
              type="button"
              className={styles.addRefs}
              onClick={openPicker}
              disabled={busy}
            >
              <Plus />
              Add images
            </button>
            <ul className={styles.refList}>
              {generator.refImages.map((img, i) => (
                <li key={img.id} className={styles.refRow}>
                  <span className={styles.refThumb}>
                    <img src={img.url} alt={img.title} />
                    <span className={styles.refOrdinal}>{i + 1}</span>
                  </span>
                  <div className={styles.refMain}>
                    {/* Native on purpose: the phone's own wheel is the best
                        picker there is for four words. */}
                    <select
                      className={styles.roleSelect}
                      value={img.role ?? 'reference'}
                      onChange={(e) =>
                        generator.setRefRole(img.id, e.target.value as RefRole)
                      }
                      disabled={busy}
                    >
                      {REF_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {isReadRole(img.role) && (
                      <p className={styles.reading}>
                        {img.reading?.status === 'done'
                          ? img.reading.text
                          : img.reading?.status === 'error'
                            ? img.reading.message
                            : 'Reading...'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label="Remove"
                    onClick={() => {
                      generator.removeRefImage(img.id)
                      if (generator.refImages.length === 1) back()
                    }}
                    disabled={busy}
                  >
                    <X />
                  </button>
                </li>
              ))}
            </ul>
          </ComposerBody>
          <DoneFooter onClick={back} />
        </>
      )}

      {step === 'aspect' && (
        <TileGrid>
          {ALL_RATIOS.map((r) => (
            <Tile
              key={r.label}
              on={r.label === generator.aspectRatio}
              onClick={() => {
                generator.setOrientation(r.w >= r.h ? 'landscape' : 'portrait')
                generator.setAspectRatio(r.label)
                back()
              }}
            >
              <RatioIcon w={r.w} h={r.h} />
              {r.label}
            </Tile>
          ))}
        </TileGrid>
      )}

      {step === 'count' && (
        <TileGrid note="Per model, per prompt.">
          {COUNTS.map((n) => (
            <Tile
              key={n}
              big
              on={n === modelSelector.gensPerModel}
              onClick={() => {
                modelSelector.adjustGens(n - modelSelector.gensPerModel)
                back()
              }}
            >
              {n}
            </Tile>
          ))}
        </TileGrid>
      )}

      <ExistingImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        isLoading={userImages.isLoading}
        alreadyCollectedIds={new Set(generator.refImages.map((r) => r.id))}
        onRefresh={userImages.refresh}
        uploadGroupId={uploadGroupId}
        onConfirm={(selected) => {
          generator.addRefImages(
            selected.map((s) => ({ id: s.id, url: s.url, title: s.title })),
          )
          if (selected.length > 0) setStep('refs')
        }}
      />
      <ConfirmDialog {...dialogProps} />
    </ComposerRoot>
  )
}
