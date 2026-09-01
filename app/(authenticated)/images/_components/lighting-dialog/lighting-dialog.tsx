'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import styles from './lighting-dialog.module.css'
import type { RefImage } from '#/features/ai-images/hooks/use-generator'
import { estimateImageCostCents } from '#/features/ai-images/models'
import {
  defaultLightingModelId,
  lightingModelOptions,
} from '#/features/ai-images/lighting'
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
  SingleSelect,
} from '#/components'
import { cx } from '#/lib/utils'

interface LightingDialogProps {
  open: boolean
  /** The reference strip's contents -- every one of them a candidate to
   *  relight, which is the top half of this dialog. */
  images: Array<RefImage>
  busy: boolean
  onGenerate: (
    imageIds: Array<string>,
    effectIds: Array<string>,
    modelId: string,
  ) => void
  onCancel: () => void
}

/**
 * Tick pictures, tick lights, press Generate (#563).
 *
 * **Shots' dialog with one section removed, deliberately kept that close.**
 * Same place in the panel, same "every pair is its own generation", same model
 * picker, so the two read as one idea applied twice rather than two features
 * that happen to sit together. What is gone is the Instructions field: an
 * effect is a whole finished paragraph about light, and a typed nudge landing
 * next to it either says nothing or fights it -- Shots needs one because a
 * camera angle says nothing about where the subject is.
 *
 * **The tiles are words, not pictures.** Shots earned thumbnails because a
 * camera position is geometry you cannot name faster than you can see it; a
 * light has a name that already means something. They would be worth adding
 * once #562 can make an effect from a reference picture, since that flow has a
 * picture of the light in hand at the moment the effect is created -- until
 * then a thumbnail would be a render commissioned to illustrate itself.
 *
 * **The note under Soft Split Field is a model result, not a caution about the
 * picture.** Grok renders it as a backdrop swap with the skin untouched. It
 * stays visible rather than filtering the model list, on Shots' reasoning about
 * `needsBack`: say what is known and leave the press to the person looking at
 * it.
 */
export function LightingDialog({
  open,
  images,
  busy,
  onGenerate,
  onCancel,
}: LightingDialogProps) {
  const models = useMemo(() => lightingModelOptions(), [])
  const [pickedImages, setPickedImages] = useState<Array<string>>([])
  const [pickedEffects, setPickedEffects] = useState<Array<string>>([])
  const [modelId, setModelId] = useState(() => defaultLightingModelId())

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

  const total = pickedImages.length * pickedEffects.length

  const estimate = useMemo(
    () => estimateImageCostCents([modelId], Math.max(total, 1), true),
    [modelId, total],
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
                  disabled={busy}
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
            {LIGHTING_EFFECTS.map((effect) => {
              const isOn = pickedEffects.includes(effect.id)
              return (
                <button
                  key={effect.id}
                  type="button"
                  className={cx(styles.tile, isOn && styles.tileOn)}
                  aria-pressed={isOn}
                  disabled={busy}
                  onClick={() => toggle(setPickedEffects, effect.id)}
                >
                  <span className={styles.tileLabel}>{effect.label}</span>
                  {'note' in effect && (
                    <span className={styles.tileNote}>{effect.note}</span>
                  )}
                  {isOn && <Check className={styles.tileCheck} />}
                </button>
              )
            })}
          </div>
        </div>

        <SingleSelect
          options={models}
          value={modelId}
          /* Null is SingleSelect reporting the chosen pill pressed again. There
             is no "no model" here, so that press is a no-op. */
          onChange={(next) => next && setModelId(next)}
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
            loading={busy}
            loadingText="Sending"
            disabled={total === 0}
            onClick={() => onGenerate(pickedImages, pickedEffects, modelId)}
          >
            {total > 1 ? `Generate ${total} images` : 'Generate'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
