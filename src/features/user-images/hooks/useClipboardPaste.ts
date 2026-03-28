/**
 * Clipboard paste-to-upload hook.
 *
 * Listens for paste events and uploads image data from the clipboard
 * with optimistic preview using object URLs.
 */

import { useEffect } from 'react'
import { parseFilenameToTitle } from '../lib/filename-parser'

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

export interface PastedImage {
  file: File
  previewUrl: string
  title: string
  tempId: string
}

interface UseClipboardPasteOptions {
  onPasteImage: (image: PastedImage) => void
  onUpload: (
    tempId: string,
    file: File,
    title: string,
    previewUrl: string,
  ) => Promise<void>
}

export function useClipboardPaste({
  onPasteImage,
  onUpload,
}: UseClipboardPasteOptions) {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      let imageFile: File | null = null

      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        imageFile = new File([file], formatPastedImageName(item.type), {
          type: file.type,
        })
        break
      }

      if (!imageFile) return

      event.preventDefault()

      const pasted: PastedImage = {
        file: imageFile,
        previewUrl: URL.createObjectURL(imageFile),
        title: parseFilenameToTitle(imageFile.name),
        tempId: `paste-${Date.now()}-${crypto.randomUUID()}`,
      }

      onPasteImage(pasted)

      // Defer upload so the browser can paint the optimistic card first
      setTimeout(() => {
        onUpload(pasted.tempId, pasted.file, pasted.title, pasted.previewUrl)
      }, 0)
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [onPasteImage, onUpload])
}
