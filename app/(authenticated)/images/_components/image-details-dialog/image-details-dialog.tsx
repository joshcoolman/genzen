'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './image-details-dialog.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { getModelName } from '#/features/ai-images/models'
import { generationInputIds } from '#/features/ai-images/generation-inputs'
import { imageUrl as referenceUrl } from '#/lib/image-url'
import {
  ActionButton,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components'

interface ImageDetailsDialogProps {
  image: SavedAiImage | null
  imageUrl?: string
  busy: boolean
  error?: string
  onLoad: (image: SavedAiImage) => void
  onGenerate: (image: SavedAiImage) => void
  onClose: () => void
}

export function ImageDetailsDialog({
  image,
  imageUrl,
  busy,
  error,
  onLoad,
  onGenerate,
  onClose,
}: ImageDetailsDialogProps) {
  return (
    <Dialog
      open={image !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={styles.content}>
        {image && (
          <DetailsContent
            key={image.id}
            image={image}
            imageUrl={imageUrl}
            busy={busy}
            error={error}
            onLoad={onLoad}
            onGenerate={onGenerate}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailsContent({
  image,
  imageUrl,
  busy,
  error,
  onLoad,
  onGenerate,
}: Omit<ImageDetailsDialogProps, 'image' | 'onClose'> & {
  image: SavedAiImage
}) {
  const isUpload = image.origin === 'upload'
  const metadata = image.generation_metadata
  const prompt = metadata?.prompt ?? image.description ?? ''
  const description = isUpload
    ? (image.description ?? '')
    : (metadata?.image_description ?? '')
  const references = generationInputIds(metadata)

  const descriptionSection = (
    <Description
      image={image}
      text={description}
      busy={busy}
      error={error}
      onGenerate={onGenerate}
    />
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isUpload ? 'Upload details' : 'Generation details'}
        </DialogTitle>
        <DialogDescription className={styles.filename}>
          {isUpload
            ? image.title
            : [
                metadata?.model ? getModelName(metadata.model) : image.title,
                metadata?.aspect_ratio,
              ]
                .filter(Boolean)
                .join(' · ')}
        </DialogDescription>
      </DialogHeader>
      {imageUrl && (
        <div
          className={styles.preview}
          style={{ backgroundImage: `url(${imageUrl})` }}
          role="img"
          aria-label={isUpload ? image.title : 'Generated image'}
        />
      )}
      {isUpload ? (
        descriptionSection
      ) : (
        <>
          <section className={styles.section} aria-label="Prompt">
            <h3 className={styles.label}>Prompt</h3>
            <p className={styles.description}>
              {prompt || 'No prompt recorded'}
            </p>
            <div className={styles.actions}>
              {prompt && (
                <CopyTextButton
                  key={prompt}
                  text={prompt}
                  label="Copy prompt"
                />
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onLoad(image)}
              >
                Load into generator
              </Button>
            </div>
          </section>
          {references.length > 0 && (
            <section className={styles.section} aria-label="Reference images">
              <h3 className={styles.label}>Reference images</h3>
              <div className={styles.references}>
                {references.map((id, index) => (
                  <ReferenceImage key={id} id={id} number={index + 1} />
                ))}
              </div>
            </section>
          )}
          <details className={styles.section}>
            <summary className={styles.summary}>
              {description.trim() ? 'Description' : 'Describe this image'}
            </summary>
            <p className={styles.note}>
              Describe the resulting image separately from the original prompt.
            </p>
            {descriptionSection}
          </details>
          <a
            className={styles.activity}
            href={`/activity?entry=${image.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View in Activity
          </a>
        </>
      )}
    </>
  )
}

function ReferenceImage({ id, number }: { id: string; number: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={styles.reference}>
      {failed ? (
        <span>Reference {number} unavailable</span>
      ) : (
        <img
          src={referenceUrl(id, 'thumb')}
          alt={`Reference image ${number}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

function Description({
  image,
  text,
  busy,
  error,
  onGenerate,
}: {
  image: SavedAiImage
  text: string
  busy: boolean
  error?: string
  onGenerate: (image: SavedAiImage) => void
}) {
  const hasDescription = text.trim().length > 0
  return (
    <div className={styles.section}>
      <p className={styles.description}>
        {hasDescription ? text : 'No description yet'}
      </p>
      {busy && <p role="status">Generating description…</p>}
      {error && <p role="alert">{error}</p>}
      <DialogFooter className={styles.footer}>
        {hasDescription && (
          <CopyTextButton key={text} text={text} label="Copy description" />
        )}
        <ActionButton
          type="button"
          loading={busy}
          loadingText="Generating"
          disabled={busy}
          onClick={() => onGenerate(image)}
        >
          {hasDescription ? 'Regenerate description' : 'Generate description'}
        </ActionButton>
      </DialogFooter>
    </div>
  )
}

function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const active = useRef(true)

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      if (!active.current) return
      setError(false)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      if (!active.current) return
      setCopied(false)
      setError(true)
    }
  }

  return (
    <div className={styles.copy}>
      <Button variant="secondary" size="sm" onClick={() => void copy()}>
        {copied ? 'Copied' : label}
      </Button>
      {error && (
        <p role="alert">Could not copy. Select the text to copy it manually.</p>
      )}
    </div>
  )
}
