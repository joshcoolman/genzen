/**
 * Clipboard paste-to-upload hook.
 *
 * Listens for paste events and uploads any image data from the clipboard.
 */

import { useEffect } from 'react'
import { processAndUploadFiles } from '../lib/process-files'
import type { CreateUserImageInput } from '../types'

function formatPastedImageName(mimeType: string): string {
  const ext = mimeType.split('/')[1] || 'png'
  const now = new Date()
  const timestamp = now
    .toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(',', '')
  return `Pasted Image ${timestamp}.${ext}`
}

interface UseClipboardPasteOptions {
  onUpload: (input: CreateUserImageInput) => Promise<void>
  enabled?: boolean
}

export function useClipboardPaste({
  onUpload,
  enabled = true,
}: UseClipboardPasteOptions) {
  useEffect(() => {
    if (!enabled) return

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      const imageFiles: Array<File> = []

      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue

        const renamed = new File([file], formatPastedImageName(item.type), {
          type: file.type,
        })
        imageFiles.push(renamed)
      }

      if (imageFiles.length === 0) return

      event.preventDefault()

      try {
        await processAndUploadFiles(imageFiles, onUpload)
      } catch (error) {
        console.error('Clipboard upload failed:', error)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [onUpload, enabled])
}
