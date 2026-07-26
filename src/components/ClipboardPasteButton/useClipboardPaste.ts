'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type ClipboardPasteState = 'idle' | 'ready' | 'received' | 'error'

interface UseClipboardPasteOptions {
  onImagePasted: (file: File) => void
  enabled?: boolean
}

interface UseClipboardPasteReturn {
  state: ClipboardPasteState
  errorMessage: string | null
  reset: () => void
}

export function useClipboardPaste({
  onImagePasted,
  enabled = false,
}: UseClipboardPasteOptions): UseClipboardPasteReturn {
  const [state, setState] = useState<ClipboardPasteState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    setState((prev) => (prev === 'idle' ? 'idle' : 'ready'))
    setErrorMessage(null)
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current)
      errorTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      setState('ready')
    } else {
      setState('idle')
      setErrorMessage(null)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      let imageFile: File | null = null

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            imageFile = file
            break
          }
        }
      }

      if (imageFile) {
        event.preventDefault()
        setState('received')
        onImagePasted(imageFile)
      } else {
        setState('error')
        setErrorMessage('Paste an image file')
        errorTimeoutRef.current = setTimeout(() => {
          setState('ready')
          setErrorMessage(null)
        }, 2000)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
    }
  }, [enabled, onImagePasted])

  return { state, errorMessage, reset }
}
