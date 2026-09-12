import { CheckCircle2, Circle } from 'lucide-react'
import styles from './model-picker.module.css'
import type { VideoModel } from '#/features/video/models'
import type { VideoImageInput } from '#/features/video/inputs'
import { imageCompatibility } from '#/features/video/inputs'
import { pricePerSecondFor } from '#/features/video/models'
import { cx } from '#/lib/utils'

/** Roles cannot be represented by the image picker's single capacity column. */
export function ModelPicker({
  models,
  selectedSlug,
  images,
  resolution,
  generateAudio,
  disabled,
  onSelect,
}: {
  models: Array<VideoModel>
  selectedSlug?: string
  images: Array<VideoImageInput>
  resolution: string
  generateAudio: boolean
  disabled: boolean
  onSelect: (slug: string) => void
}) {
  const rows = models
    .map((model) => ({ model, reason: imageCompatibility(model, images) }))
    .sort((a, b) => Number(!!a.reason) - Number(!!b.reason))
  return (
    <section className={styles.root} aria-label="Video models">
      <div className={styles.heading}>
        <span>Model</span>
        <span aria-live="polite">
          {rows.filter((r) => !r.reason).length} compatible
        </span>
        <span>$/s</span>
      </div>
      {rows.map(({ model, reason }) => {
        const selected = model.slug === selectedSlug
        const refs = model.endpoints.withReferences
        const capability = refs?.references
          ? `Up to ${refs.references.max} refs ${refs.firstFrameParam ? '+ frames' : 'or first + last frame'}`
          : model.endpoints.withImage?.acceptsEndImage ||
              model.endpoints.withFirstAndLastImage
            ? 'First + last frame'
            : model.endpoints.withImage
              ? 'First frame'
              : 'Text only'
        return (
          <button
            key={model.slug}
            type="button"
            className={cx(styles.model, selected && styles.selected)}
            disabled={disabled || !!reason}
            aria-pressed={selected}
            onClick={() => onSelect(model.slug)}
          >
            {selected ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            <span className={styles.name}>
              {model.label}
              <small>{reason ?? capability}</small>
            </span>
            <span className={styles.price}>
              {(
                pricePerSecondFor(
                  model,
                  selected ? resolution : undefined,
                  generateAudio,
                ) / 100
              ).toFixed(2)}
            </span>
          </button>
        )
      })}
    </section>
  )
}
