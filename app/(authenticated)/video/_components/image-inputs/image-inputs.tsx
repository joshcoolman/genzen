import { Plus, X } from 'lucide-react'
import styles from './image-inputs.module.css'
import type { VideoEndpoint } from '#/features/video/models'
import type { VideoImageInput, VideoImageRole } from '#/features/video/inputs'
import { MAX_VIDEO_IMAGES, referenceLabel } from '#/features/video/inputs'

export function ImageInputs({
  images,
  endpoint,
  disabled,
  onAdd,
  onRemove,
  onClear,
  onRoleChange,
  error,
}: {
  images: Array<VideoImageInput & { url: string; title: string }>
  endpoint?: VideoEndpoint
  disabled: boolean
  onAdd: () => void
  onRemove: (id: string) => void
  onClear: () => void
  onRoleChange: (id: string, role: VideoImageRole) => void
  error: string | null
}) {
  const refs = images.filter((i) => i.role === 'reference')
  const hasFrames = images.some((i) => i.role !== 'reference')
  const referenceFee =
    Math.max(
      0,
      refs.length - (endpoint?.references?.includedInPrice ?? refs.length),
    ) * (endpoint?.references?.extraImageCents ?? 0)
  return (
    <section className={styles.root} aria-label="Video images">
      <div className={styles.heading}>
        <span>Images{images.length > 0 && ` · ${images.length}`}</span>
        {images.length > 0 && (
          <button type="button" onClick={onClear} disabled={disabled}>
            Clear
          </button>
        )}
      </div>
      <div className={styles.strip}>
        {images.map((image, index) => (
          <div key={image.id} className={styles.item}>
            <div className={styles.frame}>
              <img src={image.url} alt={image.title} />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove image ${index + 1}`}
                onClick={() => onRemove(image.id)}
                disabled={disabled}
              >
                <X size={12} />
              </button>
              {image.role === 'reference' && (
                <span className={styles.ordinal}>
                  {referenceLabel(
                    endpoint,
                    refs.findIndex((i) => i.id === image.id),
                  )}
                </span>
              )}
            </div>
            <select
              aria-label={`Role of image ${index + 1}`}
              value={image.role}
              disabled={disabled}
              onChange={(event) =>
                onRoleChange(image.id, event.target.value as VideoImageRole)
              }
            >
              <option value="first">First frame</option>
              <option value="reference">Reference</option>
              <option value="last">Last frame</option>
            </select>
          </div>
        ))}
        {images.length < MAX_VIDEO_IMAGES && (
          <button
            type="button"
            className={styles.add}
            onClick={onAdd}
            disabled={disabled}
          >
            <Plus size={16} />
            Add image
          </button>
        )}
      </div>
      <p className={styles.hint} aria-live="polite">
        {error ??
          (refs.length > 0
            ? `${hasFrames ? 'Frames set the opening and ending. ' : ''}References guide appearance, without fixing a frame.${endpoint?.references ? ` ${refs.length}/${endpoint.references.max} references.` : ''}`
            : images.length > 0
              ? 'First frame starts the shot. Last frame sets where it ends.'
              : 'Add images, then choose first frame, reference, or last frame.')}
      </p>
      {refs.length > 0 && endpoint?.references && (
        <p className={styles.hint}>
          Refer to {referenceLabel(endpoint, 0)}
          {refs.length > 1 ? `, ${referenceLabel(endpoint, 1)}` : ''}
          {refs.length > 2 ? ', …' : ''} in your prompt.
        </p>
      )}
      {referenceFee > 0 && (
        <p className={styles.hint}>
          Includes ${(referenceFee / 100).toFixed(2)} in reference fees per
          clip.
        </p>
      )}
    </section>
  )
}
