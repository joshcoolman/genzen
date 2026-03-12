import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { cropTo16x9, fileToBase64 } from '@/features/ai-video/lib/crop-to-16x9'

interface UseFirstFrameGeneratorOptions {
  accessToken: string | undefined
  firstFrame: {
    status: string
    reset: () => void
    setGenerating: (previewUrl?: string) => void
    setCompleted: (url: string, recordId: string) => void
    setFailed: (msg: string) => void
  }
  onResetDownstream: () => void
}

export interface FirstFrameGeneratorState {
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string) => void
}

export function useFirstFrameGenerator({
  accessToken,
  firstFrame,
  onResetDownstream,
}: UseFirstFrameGeneratorOptions): FirstFrameGeneratorState {
  async function processFile(file: File) {
    if (!accessToken) return

    let croppedDataUrl: string
    let originalDataUrl: string
    try {
      ;[originalDataUrl, croppedDataUrl] = await Promise.all([
        fileToBase64(file),
        cropTo16x9(file),
      ])
    } catch {
      firstFrame.setFailed('Failed to process image')
      return
    }

    firstFrame.setGenerating(croppedDataUrl)
    onResetDownstream()

    try {
      const result = await uploadVideoFrame({
        data: {
          imageBase64: croppedDataUrl,
          originalBase64: originalDataUrl,
          frameType: 'first',
          accessToken,
        },
      })
      firstFrame.setCompleted(result.signedUrl, result.recordId)
    } catch (err) {
      firstFrame.setFailed(
        err instanceof Error ? err.message : 'Failed to upload frame',
      )
    }
  }

  function setSourceFile(file: File) {
    processFile(file)
  }

  function setSourceFromUrl(url: string, _name: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) return
        const file = new File([blob], 'library-image.png', {
          type: 'image/png',
        })
        processFile(file)
      }, 'image/png')
    }
    img.src = url
  }

  return {
    setSourceFile,
    setSourceFromUrl,
  }
}
