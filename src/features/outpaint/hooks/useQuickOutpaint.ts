import { useCallback, useEffect, useState } from 'react'
import { detectAspectRatio } from '@/features/ai-images/constants'

export interface QuickOutpaintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceImageUrl: string
  targetAspectRatio: string
  sourceAspectRatio: string | null
  onSuccess?: (recordId: string) => void
}

export interface UseQuickOutpaintReturn {
  needsOutpaint: boolean
  isDetecting: boolean
  openDialog: () => void
  dialogProps: QuickOutpaintDialogProps
}

interface UseQuickOutpaintOptions {
  sourceImageUrl: string | null | undefined
  expectedAspectRatio: string
  onSuccess?: (recordId: string) => void
}

export function useQuickOutpaint({
  sourceImageUrl,
  expectedAspectRatio,
  onSuccess,
}: UseQuickOutpaintOptions): UseQuickOutpaintReturn {
  const [sourceRatio, setSourceRatio] = useState<string | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!sourceImageUrl) {
      setSourceRatio(null)
      return
    }

    setIsDetecting(true)
    const img = new Image()
    img.onload = () => {
      const ratio = detectAspectRatio(img.naturalWidth, img.naturalHeight)
      setSourceRatio(ratio)
      setIsDetecting(false)
    }
    img.onerror = () => {
      setSourceRatio(null)
      setIsDetecting(false)
    }
    img.src = sourceImageUrl
  }, [sourceImageUrl])

  const needsOutpaint =
    sourceRatio !== null && sourceRatio !== expectedAspectRatio

  const openDialog = useCallback(() => {
    setDialogOpen(true)
  }, [])

  return {
    needsOutpaint,
    isDetecting,
    openDialog,
    dialogProps: {
      open: dialogOpen,
      onOpenChange: setDialogOpen,
      sourceImageUrl: sourceImageUrl ?? '',
      targetAspectRatio: expectedAspectRatio,
      sourceAspectRatio: sourceRatio,
      onSuccess,
    },
  }
}
