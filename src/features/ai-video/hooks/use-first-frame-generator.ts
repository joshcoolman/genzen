import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { cropTo16x9, fileToBase64 } from '@/features/ai-video/lib/crop-to-16x9'
import { fetchImageAsBase64 } from '@/lib/server/fetch-image-base64.server'

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

    firstFrame.setGenerating(originalDataUrl)
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

  async function setSourceFromUrl(url: string, _name: string) {
    if (!accessToken) return
    try {
      const { base64 } = await fetchImageAsBase64({
        data: { url, accessToken },
      })
      const res = await fetch(base64)
      const blob = await res.blob()
      const file = new File([blob], 'library-image.png', { type: 'image/png' })
      processFile(file)
    } catch (err) {
      console.error('Failed to load image from library:', err)
    }
  }

  return {
    setSourceFile,
    setSourceFromUrl,
  }
}
