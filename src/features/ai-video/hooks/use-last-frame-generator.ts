import type { Generation } from '@/features/ai-video/types'
import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { createGeneration } from '@/features/ai-video/server/create-generation.server'
import { cropTo16x9, fileToBase64 } from '@/features/ai-video/lib/crop-to-16x9'

interface UseLastFrameGeneratorOptions {
  accessToken: string | undefined
  firstFrame: {
    status: string
    url: string | null
    recordId: string | null
  }
  lastFrame: {
    status: string
    reset: () => void
    setGenerating: (previewUrl?: string) => void
    setCompleted: (url: string, recordId: string) => void
    setFailed: (msg: string) => void
    setStatus: (status: 'idle' | 'generating' | 'completed' | 'error') => void
    setUrl: (url: string | null) => void
  }
  workspaceId: string
  addGeneration: (gen: Generation) => void
}

export interface LastFrameGeneratorState {
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string) => void
  resetLastFrameState: () => void
}

export function useLastFrameGenerator({
  accessToken,
  firstFrame,
  lastFrame,
  workspaceId,
  addGeneration,
}: UseLastFrameGeneratorOptions): LastFrameGeneratorState {
  function setSourceFile(file: File) {
    processFile(file)
  }

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
      lastFrame.setFailed('Failed to process image')
      return
    }

    // Show preview immediately then upload
    lastFrame.setGenerating(originalDataUrl)

    if (firstFrame.status !== 'completed' || !firstFrame.recordId) {
      // No first frame yet — just show preview
      lastFrame.setUrl(originalDataUrl)
      lastFrame.setStatus('idle')
      return
    }

    try {
      const result = await uploadVideoFrame({
        data: {
          imageBase64: croppedDataUrl,
          originalBase64: originalDataUrl,
          frameType: 'last',
          accessToken,
        },
      })

      const gen = await createGeneration({
        data: {
          workspaceId,
          firstFrameId: firstFrame.recordId,
          lastFrameId: result.recordId,
          accessToken,
        },
      })

      const newGeneration: Generation = {
        id: gen.id,
        createdAt: new Date().toISOString(),
        firstFrame: {
          id: firstFrame.recordId,
          url: firstFrame.url,
          status: 'completed',
        },
        lastFrame: {
          id: result.recordId,
          url: result.signedUrl,
          status: 'completed',
        },
        video: null,
      }
      addGeneration(newGeneration)
      lastFrame.setCompleted(result.signedUrl, result.recordId)
    } catch (err) {
      lastFrame.setFailed(
        err instanceof Error ? err.message : 'Failed to upload frame',
      )
    }
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

  function resetLastFrameState() {
    lastFrame.reset()
  }

  return {
    setSourceFile,
    setSourceFromUrl,
    resetLastFrameState,
  }
}
