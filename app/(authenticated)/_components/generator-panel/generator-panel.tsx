'use client'

import { useState } from 'react'
import { PromptList } from '../prompt-list/prompt-list'
import { GeneratePromptButton } from '../generate-prompt-dialog/generate-prompt-dialog'
import { MetaPromptButton } from '../meta-prompt-dialog/meta-prompt-dialog'
import { ExistingImagePicker } from '../existing-image-picker/existing-image-picker'
import { ModelSelector } from '../model-selector/model-selector'
import styles from './generator-panel.module.css'
import type { GeneratorState } from '#/features/ai-images/hooks/use-generator'
import type { UserImage } from '#/features/user-images/types'
import type { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { pricedForImages } from '#/features/ai-images/model-selector/unified-models'
import { REF_ROLES, isReadRole } from '#/features/ai-images/ref-roles'
import { populateStoryboard } from '#/features/ai-images/server/populate-storyboard.action'
import { systemInstructionsPrefix } from '#/features/ai-images/system-instructions'
import { formatCents } from '#/lib/format'
import {
  ActionButton,
  AspectRatioSelect,
  ConfirmDialog,
  CostNote,
  ExpandableText,
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
  /** The group the surrounding route is standing in, which an upload from the
   *  picker lands in (#549). Canvas has none and passes nothing. */
  uploadGroupId?: string | null
  /** Opens the Shots dialog for the staged set (#553). Optional because the
   *  route owns the submits, not the panel: Images passes it, Canvas does not,
   *  and the button is absent rather than dead where nobody handles it. */
  onShots?: () => void
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
  uploadGroupId = null,
  onShots,
}: GeneratorPanelProps) {
  const activePrompts = generator.prompts.filter((p) => p.trim())
  const readImages = generator.refImages.filter((img) => isReadRole(img.role))
  const storyboardOnly =
    activePrompts.length > 0 &&
    activePrompts.every((p) => /^\s*\/storyboard(?:\s|$)/i.test(p))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [populating, setPopulating] = useState(false)
  const [populateError, setPopulateError] = useState<string | null>(null)
  const { confirm, dialogProps } = useConfirm()

  /**
   * One storyboard command, and nothing else to lose.
   *
   * Populate replaces the command with the prompts it planned, so it is only
   * offered when the command is the whole of the prompt list -- replacing one
   * row of several would need a per-row action, and reading the planned set is
   * the point of the button, not editing it in place beside other work.
   */
  const canPopulate =
    storyboardOnly && activePrompts.length === 1 && !generator.loading

  /**
   * Plan without spending on images.
   *
   * The command row is consumed rather than kept: leaving it in the list means
   * the next Generate plans the brief a second time and renders the whole set
   * twice. The ratio the plan chose is pushed into the panel so the user
   * starts from the model's answer rather than from whatever was there before.
   */
  async function handlePopulate() {
    setPopulating(true)
    setPopulateError(null)
    try {
      const result = await populateStoryboard({
        originalInput: activePrompts[0],
        referenceIds: generator.refImages
          .filter((img) => !isReadRole(img.role))
          .map((img) => img.id),
        systemInstructions: systemInstructionsPrefix(),
      })
      generator.clearPrompts()
      generator.setPromptAtIndex(0, result.prompts[0])
      if (result.prompts.length > 1)
        generator.appendPrompts(result.prompts.slice(1))
      generator.setAspectRatio(result.aspectRatio)
    } catch (reason) {
      setPopulateError(
        reason instanceof Error ? reason.message : String(reason),
      )
    } finally {
      setPopulating(false)
    }
  }

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
  function addGeneratedPrompts(texts: Array<string>) {
    if (texts.length === 0) return
    const untouched =
      generator.prompts.length === 1 && generator.prompts[0].trim() === ''
    if (untouched) {
      const [first, ...rest] = texts
      generator.setPromptAtIndex(0, first)
      if (rest.length > 0) generator.appendPrompts(rest)
    } else {
      generator.appendPrompts(texts)
    }
  }

  const addGeneratedPrompt = (text: string) => addGeneratedPrompts([text])

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
    await generator.handleGenerate()
  }

  return (
    <div className={styles.root}>
      {/* Prompt textareas. Nothing above them any more. */}
      <PromptList
        imageCommands
        prompts={generator.prompts}
        onUpdatePrompt={generator.setPromptAtIndex}
        onAddPrompt={generator.addPrompt}
        onRemovePrompt={generator.removePrompt}
        disabled={generator.loading}
        placeholders={{
          first: 'Describe your image, or type / for a command...',
          additional: 'Additional prompt...',
        }}
        onClearPrompts={generator.clearPrompts}
        /* Filling a prompt is not a prompt, so it is passed in rather than
           built in: PromptList never learns that prompts can be generated.
           Beside Add prompt because both are ways of getting a row filled.
           System instructions are not here at all any more -- they are the
           header's, on all three surfaces that render this panel. */
        actionSlot={
          <>
            <GeneratePromptButton
              onAdd={addGeneratedPrompt}
              disabled={generator.loading}
            />
            {/* Only with something to work from (#645). Without references it
                would be Generate prompt with an extra field, and the whole
                mechanism is that the model is looking at the staged set. */}
            {generator.refImages.length > 0 && (
              <MetaPromptButton
                images={generator.refImages}
                onAdd={addGeneratedPrompts}
                disabled={generator.loading}
              />
            )}
          </>
        }
      />

      {/* The set, unbounded (#341). No `max`: what a model can hold is in the
          picker's Refs column, applied at submit, and reported on the card. The
          strip refusing an image was how staged work got deleted by ticking a
          smaller model. It still disables with no model selected at all --
          there is nothing to attach images to. */}
      {/* The heading is back, and so is a box around the set. It was dropped as
          naming the obvious, which it was -- but the strip has no edges of its
          own, so an empty one was a lone dashed square floating between the
          prompt and the controls with nothing saying where the group started
          or stopped. The border draws the group; the heading sits above it,
          styled like the dock's own "Generate" rather than as an eyebrow, so
          the panel has one kind of label rather than two. Clear rides with the
          heading, which is somewhere better than the end of a row of
          thumbnails. No per-thumbnail titles: they are the source image's name,
          which is a model name as often as anything descriptive, so the line
          under each square cost height to say nothing. The ordinal badge is
          what identifies an image the prompt refers to. */}
      <div className={styles.refsGroup}>
        <div className={styles.refsHead}>
          <span className={styles.refsLabel}>Ref images</span>
          {/* Shots (#553): the staged set is already the answer to "which
              pictures", so the way in is here rather than a card's `...` menu.
              It needs at least one reference and has nothing to say during a
              run, on the same condition Clear uses. */}
          {onShots && generator.refImages.length > 0 && !generator.loading && (
            <button
              type="button"
              onClick={onShots}
              className={styles.refsClear}
            >
              Shots
            </button>
          )}
          {generator.refImages.length > 0 && !generator.loading && (
            <button
              type="button"
              onClick={() => generator.replaceRefImages([])}
              className={styles.refsClear}
            >
              Clear
            </button>
          )}
        </div>
        <div className={styles.refs}>
          <RefImageStrip
            images={generator.refImages}
            onAdd={() => {
              void userImages.refresh()
              setPickerOpen(true)
            }}
            onRemove={generator.removeRefImage}
            disabled={generator.loading || generator.maxRefImages === 0}
            /* What each picture is for (#635). The first option is the one
               that is sent; the rest are read once and travel as text, and
               their readings are listed under the strip so what the model
               will be told is on screen before the press. */
            roles={{
              options: REF_ROLES.map((r) => ({ value: r.id, label: r.label })),
              onChange: generator.setRefRole,
            }}
          />
          {readImages.length > 0 && (
            <ul className={styles.readings} aria-label="Readings">
              {readImages.map((img) => (
                <li key={img.id} className={styles.reading}>
                  <span className={styles.readingLabel}>
                    {REF_ROLES.find((r) => r.id === img.role)?.label}
                  </span>
                  {img.reading?.status === 'done' ? (
                    <ExpandableText text={img.reading.text} lines={2} />
                  ) : img.reading?.status === 'error' ? (
                    <p className={styles.readingError} role="alert">
                      {img.reading.message}
                    </p>
                  ) : (
                    <p className={styles.readingPending}>Reading...</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
        uploadGroupId={uploadGroupId}
        onConfirm={(selected) =>
          generator.addRefImages(
            selected.map((s) => ({ id: s.id, url: s.url, title: s.title })),
          )
        }
      />

      {/* Shape, count, go -- one row, left to right in the order you decide
          them. The aspect ratio moved down from the dead source row (#297)
          because it describes the request rather than the prompt.

          This was two rows until the shape and the count both turned out to
          size to their content: neither needs to stretch, so Generate takes
          the remainder of a 20rem dock instead of a row of its own. What that
          costs is the button's full label -- "Generate 6 images" does not fit
          in what is left, so the button carries the bare count and drops the
          noun. The number is the part that must not disappear: it is the
          product of prompts, models and gens, so it is routinely larger than
          anything on screen suggests, and above CONFIRM_ABOVE the dialog
          spells the whole multiplication out. */}
      <div className={styles.controls}>
        {/* Not pinned to 16:9 any more (#714): the plan chooses the ratio from
            the brief, so a control forced to one value was stating something
            that had stopped being true. Still disabled while a command is the
            prompt, because on that path the plan's answer overrides whatever
            this says -- Populate then writes the chosen ratio back here, which
            is the only press that makes this control meaningful again. */}
        <AspectRatioSelect
          orientation={generator.orientation}
          aspectRatio={generator.aspectRatio}
          onOrientationChange={generator.setOrientation}
          onAspectRatioChange={generator.setAspectRatio}
          disabled={storyboardOnly || generator.loading}
        />
        <NumberStepper
          value={modelSelector.gensPerModel}
          min={1}
          max={5}
          onAdjust={modelSelector.adjustGens}
          disabled={generator.loading}
        />
        {canPopulate && (
          <ActionButton
            onClick={() => void handlePopulate()}
            loading={populating}
            loadingText=""
            className={styles.generate}
          >
            Populate
          </ActionButton>
        )}
        <ActionButton
          onClick={() => void handleGenerateClick()}
          loading={generator.loading}
          /* Spinner only. There is no room beside it for a word at this width,
             and the panel is disabled while a run is in flight anyway. */
          loadingText=""
          disabled={!generator.canGenerate}
          className={styles.generate}
        >
          {generator.totalImages > 1
            ? `Generate ${generator.totalImages}`
            : 'Generate'}
        </ActionButton>
      </div>

      {/* Images had no cost figure at all until #416 -- on the one route where
          a stepper, a prompt list and multi-select models all multiply, so the
          count reaches double figures from a panel showing "1". */}
      {/* No model name beside the figure: the picker directly below this reads
          "Multiple (8 models)" already, and two lines saying the same thing is
          one line of noise. Video passes a spec because its own carries the
          resolution and whether audio is included, which nothing else says. */}
      {generator.prompts.some((p) => /^\s*\/storyboard(?:\s|$)/i.test(p)) && (
        <p className={styles.skillNote}>
          Storyboard plans the set from your brief -- how many images, their
          shape and what varies between them -- and renders each as its own
          full-size image. The estimate below assumes six and excludes Claude
          planning, charged once per distinct brief.
        </p>
      )}
      {populateError && (
        <p className={styles.skillNote} role="alert">
          {populateError}
        </p>
      )}
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
