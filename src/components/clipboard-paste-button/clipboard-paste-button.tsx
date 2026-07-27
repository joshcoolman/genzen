'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Button } from '../ui/button/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover/popover'
import { useClipboardPaste } from './use-clipboard-paste'

interface ClipboardPasteButtonProps {
  onImagePasted: (file: File) => void
  className?: string
}

export function ClipboardPasteButton({
  onImagePasted,
  className,
}: ClipboardPasteButtonProps) {
  const [open, setOpen] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { state, errorMessage, reset } = useClipboardPaste({
    onImagePasted,
    enabled: open,
  })

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        reset()
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current)
          closeTimeoutRef.current = null
        }
      }
    },
    [reset],
  )

  useEffect(() => {
    if (state === 'received') {
      closeTimeoutRef.current = setTimeout(() => {
        setOpen(false)
        reset()
      }, 1500)
    }
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [state, reset])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className={className}>
          <ClipboardPaste />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <p className="text-sm">
          {state === 'received' && 'Image captured'}
          {state === 'error' && (
            <span className="text-destructive">{errorMessage}</span>
          )}
          {(state === 'ready' || state === 'idle') && 'Paste your image'}
        </p>
      </PopoverContent>
    </Popover>
  )
}
