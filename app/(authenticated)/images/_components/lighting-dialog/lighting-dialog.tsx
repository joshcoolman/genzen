'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { ModelSelector } from '../../../_components/model-selector/model-selector'
import styles from './lighting-dialog.module.css'
import type { RefImage } from '#/features/ai-images/hooks/use-generator'
import { estimateImageCostCents } from '#/features/ai-images/models'
import {
  defaultLightingModelId,
  lightingModelIds,
} from '#/features/ai-images/lighting'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { pricedForImages } from '#/features/ai-images/model-selector/unified-models'
import { LIGHTING_EFFECTS } from '#/lib/prompts/lighting'
import {
  ActionButton,
  Button,
  CostNote,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components'
import { cx } from '#/lib/utils'

interface LightingDialogProps {
  open: boolean
  /** The reference strip's contents -- every one of them a candidate to
   *  relight, which is the top half of this dialog. */
  images: Array<RefImage>
  onGenerate: (
    imageIds: Array<string>,
    effectIds: Array<string>,
    modelIds: Array<string>,
  ) => void
  onCancel: () => void
}

/**
 * Tick pictures, tick lights, press Generate (#563).
 *
 * **Shots' dialog with one section removed, deliberately kept that close.**
 * Same place in the panel, same "every pair is its own generation", so the two
 * read as one idea applied twice rather than two features that happen to sit
 * together. What is behind them differs: Shots writes its prompt with two
 * vision passes and this sends a fixed setup. What is gone is the
 * Instructions field: an effect is a whole finished paragraph about light, and
 * a typed nudge landing next to it either says nothing or fights it -- Shots
 * needs one because a camera angle says nothing about where the subject is.
 *
 * **A tile shows its light where there is a picture of it, and says its name
 * where there is not.** Thumbnails arrived with `/lab/lighting` (#562): saving
 * an effect there writes the candidate you picked to
 * `public/lighting/<id>.webp`, the same file-drop convention `public/shots/`
 * uses, so there is no path in the registry to keep in step. An effect written
 * before that page existed has no such file and falls back to the name alone --
 * which is why the picture is optional rather than assumed. It is still a
 * picture of the light on one subject, which is the assumption the setup prose
 * exists to undo; it illustrates the effect, it does not promise it.
 *
 * **The models are multi-selected and the picker is collapsed.** Shots takes
 * one model because a sixteen-frame set is a thing you look at whole; a relight
 * is one picture you compare, so the useful press is one subject through
 * several models at once. It is the panel's own `ModelSelector` rather than a
 * dialog-local control, so the row of prices and reference capacities means the
 * same thing here as it does in the sidebar. Closed by default because the
 * model is the only selection that survives an open -- the pictures and the
 * lights are asked fresh each time, and a nine-row table above them would bury
 * the question being asked.
 *
 * **A tile is a name and nothing else, and one tile carried a caution that had
 * to go.** Soft Split Field was labelled "Nano Banana only", from the finding
 * that Grok rendered it as a backdrop swap with the subject untouched. The
 * label was inert -- nothing read it, and every selected model always got every
 * picked effect -- and the finding turned out to be about the prompt rather
 * than the model: it described a painted backdrop, and Grok obeyed most
 * literally. A note like Shots' `needsBack` earns its place by being a fact
 * about *this picture* that only the person looking can judge. A fact about a
 * model belongs in the file that fixes it.
 *
 * **It closes on the press, not on the run** (#563). Generate puts the pending
 * cards on the wall and the dialog goes away; the submits carry on behind it.
 * Held open until the last one landed, a press across three models sat there
 * for several seconds looking like nothing had happened -- and the one place
 * the work is actually visible was covered by the dialog reporting it. Nothing
 * here is disabled or spinning for the same reason: there is no state to show
 * after the press, because there is no dialog.
 */
export function LightingDialog({
  open,
  images,
  onGenerate,
  onCancel,
}: LightingDialogProps) {
  const allowedIds = useMemo(() => lightingModelIds(), [])
  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
    allowedIds,
    storageScope: 'lighting',
    defaultId: defaultLightingModelId(),
  })
  const [pickedImages, setPickedImages] = useState<Array<string>>([])
  const [pickedEffects, setPickedEffects] = useState<Array<string>>([])

  // Opening is the fresh question, exactly as in Shots: the pictures default to
  // whatever is staged and the lights start empty, because staging a reference
  // was already a decision and picking a light is the one being made here. The
  // model survives -- putting one picture through two models is the point of
  // having the control.
  useEffect(() => {
    if (!open) return
    setPickedImages(images.map((i) => i.id))
    setPickedEffects([])
  }, [open, images])

  // Three multiplications, not two: every picture, under every light, through
  // every model. Four references and two lights across three models is
  // twenty-four generations, and the count on the button is the only thing that
  // says so before the press.
  const total =
    pickedImages.length *
    pickedEffects.length *
    modelSelector.selectedIds.length

  const estimate = useMemo(
    () =>
      estimateImageCostCents(
        modelSelector.selectedIds,
        Math.max(pickedImages.length * pickedEffects.length, 1),
        true,
      ),
    [modelSelector.selectedIds, pickedImages.length, pickedEffects.length],
  )

  function toggle(
    set: (fn: (current: Array<string>) => Array<string>) => void,
    id: string,
  ) {
    set((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Lighting</DialogTitle>
          <DialogDescription>
            The same picture under a different light. Everything else -- the
            subject, the pose, the framing -- is meant to survive untouched.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.section}>
          <div className={styles.head}>
            <span className={styles.label}>Pictures</span>
            <span className={styles.count}>
              {pickedImages.length} of {images.length}
            </span>
          </div>
          <div className={styles.strip}>
            {images.map((image) => {
              const isOn = pickedImages.includes(image.id)
              return (
                <button
                  key={image.id}
                  type="button"
                  className={cx(styles.thumb, isOn && styles.thumbOn)}
                  style={{ backgroundImage: `url(${image.url})` }}
                  aria-pressed={isOn}
                  aria-label={image.title}
                  title={image.title}
                  onClick={() => toggle(setPickedImages, image.id)}
                >
                  {isOn && <Check className={styles.thumbCheck} />}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.head}>
            <span className={styles.label}>Lights</span>
            <span className={styles.count}>
              {pickedEffects.length} of {LIGHTING_EFFECTS.length}
            </span>
          </div>
          <div className={styles.grid}>
            {LIGHTING_EFFECTS.map((effect) => (
              <EffectTile
                key={effect.id}
                id={effect.id}
                label={effect.label}
                on={pickedEffects.includes(effect.id)}
                onClick={() => toggle(setPickedEffects, effect.id)}
              />
            ))}
          </div>
        </div>

        {/* The panel's own picker, multi-select and collapsed. Collapsed
            because the model is the one thing here that persists between
            opens -- the pictures and the lights are asked fresh every time,
            and a nine-row table above them would bury both. The summary line
            still names what is selected, so it is closed rather than
            hidden. Priced for the edit endpoint, always: a relight sends a
            source image, so there is no cheaper reading of these rows. */}
        <ModelSelector
          mode="multi"
          persistKey="genzen:lighting-models:expanded"
          defaultExpanded={false}
          selectedIds={modelSelector.selectedIds}
          visibleModels={pricedForImages(modelSelector.models, true)}
          stagedImageCount={1}
          onToggleSelected={modelSelector.toggleSelected}
          onToggleAll={modelSelector.toggleAll}
          onSelectOnly={(id) => modelSelector.selectOnly([id])}
        />

        {/* Zero until both halves are picked -- the same rule Generate
            follows. */}
        <CostNote
          cents={total === 0 ? 0 : estimate.cents}
          unpriced={estimate.unpriced}
        />

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <ActionButton
            disabled={total === 0}
            onClick={() =>
              onGenerate(pickedImages, pickedEffects, modelSelector.selectedIds)
            }
          >
            {total > 1 ? `Generate ${total} images` : 'Generate'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One light. The thumbnail is found by name -- `public/lighting/<id>.webp` --
 * so adding one is a file drop, exactly as it is for a shot.
 *
 * **A missing file is a state, not an error.** There is no way to ask the
 * server whether the picture exists before rendering, so the tile assumes one
 * and stands down when the load fails. The alternative is a flag in the
 * registry that has to be remembered every time a `.webp` is written or
 * deleted, which is a second copy of a fact the filesystem already holds.
 */
function EffectTile({
  id,
  label,
  on,
  onClick,
}: {
  id: string
  label: string
  on: boolean
  onClick: () => void
}) {
  const [hasImage, setHasImage] = useState(true)

  return (
    <button
      type="button"
      className={cx(styles.tile, on && styles.tileOn)}
      aria-pressed={on}
      onClick={onClick}
    >
      {hasImage && (
        // Decorative: the name below is the accessible name, and the picture is
        // the same information in another form.
        <img
          className={styles.tileImage}
          src={`/lighting/${id}.webp`}
          alt=""
          width={256}
          height={256}
          loading="lazy"
          onError={() => setHasImage(false)}
        />
      )}
      <span className={styles.tileLabel}>{label}</span>
      {on && <Check className={styles.tileCheck} />}
    </button>
  )
}
