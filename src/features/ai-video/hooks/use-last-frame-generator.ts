import type { Generation } from '@/features/ai-video/types'
import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { createGeneration } from '@/features/ai-video/server/create-generation.server'
import { cropTo16x9, fileToBase64 } from '@/features/ai-video/lib/crop-to-16x9'
import { fetchImageAsBase64 } from '@/lib/server/fetch-image-base64.server'

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

  function resetLastFrameState() {
    lastFrame.reset()
  }

  return {
    setSourceFile,
    setSourceFromUrl,
    resetLastFrameState,
  }
}
