'use client'

import { useState } from 'react'
import { Check, Copy, RotateCcw } from 'lucide-react'
import styles from './failed-image-card.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { classifyError } from '#/features/ai-images/error-classification'
import { getModelName } from '#/features/ai-images/models'
import { Thumbnail } from '#/components'
// Deep import while the barrel still holds the shadcn Dialog for its remaining
// consumers -- see #193.
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/dialog/dialog'

interface FailedImageCardProps {
  img: SavedAiImage
  onDelete: (img: SavedAiImage) => void
  onRetry?: (img: SavedAiImage) => void
}

export function FailedImageCard({
  img,
  onDelete,
  onRetry,
}: FailedImageCardProps) {
  const [retrying, setRetrying] = useState(false)
  const [errorOpen, setErrorOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { category } = classifyError(img.generation_error)
  const isRetryable = category === 'retryable'
  const modelName = getModelName(img.generation_metadata?.model ?? '')
  const rawError = img.generation_error

  const handleRetry = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    try {
      await onRetry(img)
    } finally {
      setRetrying(false)
    }
  }

  const handleCopy = async () => {
    if (!rawError) return
    await navigator.clipboard.writeText(rawError)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Thumbnail
        status="failed"
        failedLabel={modelName || undefined}
        failedMessage={rawError ? 'See Details' : undefined}
        onDelete={() => onDelete(img)}
        onClick={rawError ? () => setErrorOpen(true) : undefined}
        overlayActions={
          isRetryable && onRetry ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleRetry()
              }}
              disabled={retrying}
              className={styles.retry}
              aria-label="Retry"
              title="Retry generation"
            >
              <RotateCcw className={retrying ? styles.spinning : undefined} />
            </button>
          ) : undefined
        }
      >
        <p className={styles.caption}>{modelName || 'Unknown model'}</p>
        <div className={styles.subCaption}>
          <p className={styles.prompt}>
            {img.generation_metadata?.prompt ?? img.title}
          </p>
        </div>
      </Thumbnail>

      {rawError && (
        <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
          <DialogContent className={styles.popup}>
            <DialogHeader>
              <DialogTitle>
                Generation failed — {modelName || 'Unknown model'}
              </DialogTitle>
            </DialogHeader>
            <div className={styles.body}>
              <p className={styles.errorPromptText}>
                {img.generation_metadata?.prompt ?? img.title}
              </p>
              <div className={styles.errorWrap}>
                <pre className={styles.error}>{rawError}</pre>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className={styles.copy}
                  title="Copy error"
                >
                  {copied ? <Check className={styles.copied} /> : <Copy />}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
