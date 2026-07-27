'use client'

import { useState } from 'react'
import { Check, Copy, RotateCcw } from 'lucide-react'
import type { SavedAiImage } from '#/features/ai-images/types'
import { classifyError } from '#/features/ai-images/error-classification'
import { getModelName } from '#/features/ai-images/models'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Thumbnail,
} from '#/components'

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
              className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-foreground transition-all"
              aria-label="Retry"
              title="Retry generation"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`}
              />
            </button>
          ) : undefined
        }
      >
        <p className="truncate px-3 pt-2 text-xs font-medium text-foreground">
          {modelName || 'Unknown model'}
        </p>
        <div className="px-3 pt-0.5 pb-3">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {img.generation_metadata?.prompt ?? img.title}
          </p>
        </div>
      </Thumbnail>

      {rawError && (
        <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Generation failed — {modelName || 'Unknown model'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {img.generation_metadata?.prompt ?? img.title}
              </p>
              <div className="relative">
                <pre className="rounded-md bg-muted p-3 text-xs text-foreground overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {rawError}
                </pre>
                <button
                  onClick={() => void handleCopy()}
                  className="absolute top-2 right-2 rounded bg-background/80 backdrop-blur-sm p-1.5 text-muted-foreground hover:text-foreground transition-all"
                  title="Copy error"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
