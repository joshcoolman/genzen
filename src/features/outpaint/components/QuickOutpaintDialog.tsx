import { useCallback, useEffect, useState } from 'react'
import { outpaintImage } from '../server/outpaint-image.server'
import { OUTPAINT_MODELS } from '../hooks/useOutpaintPage'
import type { QuickOutpaintDialogProps } from '../hooks/useQuickOutpaint'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ActionButton } from '@/components/ActionButton'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { CREDIT_COSTS } from '@/features/credits'
import { isCreditError } from '@/features/credits/handle-credit-error'

export function QuickOutpaintDialog({
  open,
  onOpenChange,
  sourceImageUrl,
  targetAspectRatio,
  sourceAspectRatio,
  onSuccess,
}: QuickOutpaintDialogProps) {
  const { session } = useAuth()
  const credits = useCredits()
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPrompt('')
      setConfirmation(false)
    }
  }, [open])

  // Preview dimensions: source image centered in target frame
  const [targetW, targetH] = targetAspectRatio.split(':').map(Number)
  const targetRatio = targetW / targetH

  const [sourceW, sourceH] = (sourceAspectRatio ?? targetAspectRatio)
    .split(':')
    .map(Number)
  const sourceRatio = sourceW / sourceH

  let imgWidthPct: number
  let imgHeightPct: number
  if (targetRatio > sourceRatio) {
    imgHeightPct = 100
    imgWidthPct = (sourceRatio / targetRatio) * 100
  } else {
    imgWidthPct = 100
    imgHeightPct = (targetRatio / sourceRatio) * 100
  }

  const handleSubmit = useCallback(async () => {
    if (!session?.access_token || !sourceImageUrl) return

    const cost = CREDIT_COSTS.image_gen
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await outpaintImage({
        data: {
          accessToken: session.access_token,
          sourceImageUrl,
          aspectRatio: targetAspectRatio,
          model: OUTPAINT_MODELS[0].id,
          prompt: prompt.trim() || undefined,
          offset: { x: 0.5, y: 0.5 },
        },
      })

      setConfirmation(true)
      onSuccess?.(result.recordId)

      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      if (isCreditError(err)) {
        credits.showInsufficientCredits(CREDIT_COSTS.image_gen)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    session?.access_token,
    sourceImageUrl,
    targetAspectRatio,
    prompt,
    credits,
    onSuccess,
    onOpenChange,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Outpaint to {targetAspectRatio}</DialogTitle>
          <DialogDescription>
            Extend image from {sourceAspectRatio ?? 'unknown'} to{' '}
            {targetAspectRatio}
          </DialogDescription>
        </DialogHeader>

        {/* Centered preview */}
        <div className="flex justify-center">
          <div
            className="relative w-full max-h-[240px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 overflow-hidden"
            style={{
              aspectRatio: `${targetRatio}`,
              maxWidth: `${240 * targetRatio}px`,
            }}
          >
            <img
              src={sourceImageUrl}
              alt="Source"
              className="absolute select-none"
              style={{
                width: `${imgWidthPct}%`,
                height: `${imgHeightPct}%`,
                left: `${(100 - imgWidthPct) / 2}%`,
                top: `${(100 - imgHeightPct) / 2}%`,
                objectFit: 'cover',
              }}
            />
          </div>
        </div>

        {!confirmation && (
          <>
            <Textarea
              placeholder="Describe what to fill in (leave blank to just extend)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              className="resize-none"
            />

            <DialogFooter>
              <ActionButton
                onClick={handleSubmit}
                loading={isSubmitting}
                loadingText="Starting..."
              >
                Outpaint
              </ActionButton>
            </DialogFooter>
          </>
        )}

        {confirmation && (
          <p className="text-sm text-center text-muted-foreground py-2">
            Generation started — check AI Images for the result.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
