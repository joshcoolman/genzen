import { useState } from 'react'
import type { Generation, LastFrameMode } from '@/features/ai-video/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { LAST_FRAME_MODEL } from '@/features/ai-video/types'
import { generateLastFrame } from '@/features/ai-video/server/generate-last-frame.server'
import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { suggestLastFrame } from '@/features/ai-video/server/suggest-last-frame.server'
import { createGeneration } from '@/features/ai-video/server/create-generation.server'
import { CREDIT_COSTS } from '@/features/credits'
import { cropTo16x9, fileToBase64 } from '@/features/ai-video/lib/crop-to-16x9'

interface UseLastFrameGeneratorOptions {
  accessToken: string | undefined
  credits: CreditsState
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
  isImageMode: boolean
  firstFramePrompt: string
}

export interface LastFrameGeneratorState {
  lastFrameMode: LastFrameMode
  lastFramePrompt: string
  setLastFramePrompt: (prompt: string) => void
  includeFirstFrame: boolean
  setIncludeFirstFrame: (v: boolean) => void
  lastFrameImageData: string | null
  lastFrameOriginalData: string | null
  suggestingLastFrame: boolean
  generateDisabled: boolean
  lastFrameLocked: boolean
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string) => void
  activatePromptMode: () => void
  handleGenerate: () => Promise<void>
  handleSuggest: () => Promise<void>
  resetLastFrameState: () => void
}

export function useLastFrameGenerator({
  accessToken,
  credits,
  firstFrame,
  lastFrame,
  workspaceId,
  addGeneration,
  isImageMode,
  firstFramePrompt,
}: UseLastFrameGeneratorOptions): LastFrameGeneratorState {
  const [lastFrameMode, setLastFrameMode] = useState<LastFrameMode>('prompt')
  const [lastFramePrompt, setLastFramePrompt] = useState('')
  const [includeFirstFrame, setIncludeFirstFrame] = useState(true)
  const [lastFrameImageData, setLastFrameImageData] = useState<string | null>(
    null,
  )
  const [lastFrameOriginalData, setLastFrameOriginalData] = useState<
    string | null
  >(null)
  const [suggestingLastFrame, setSuggestingLastFrame] = useState(false)

  const lastFrameLocked = firstFrame.status !== 'completed'
  const generateDisabled =
    lastFrameLocked ||
    lastFrame.status === 'generating' ||
    (lastFrameMode === 'prompt' && !lastFramePrompt.trim()) ||
    (lastFrameMode === 'image' && !lastFrameImageData)

  function setSourceFile(file: File) {
    processFile(file)
  }

  async function processFile(file: File) {
    try {
      const [originalDataUrl, croppedDataUrl] = await Promise.all([
        fileToBase64(file),
        cropTo16x9(file),
      ])
      setLastFrameMode('image')
      setLastFrameImageData(croppedDataUrl)
      setLastFrameOriginalData(originalDataUrl)
      lastFrame.setStatus('idle')
      lastFrame.setUrl(croppedDataUrl)
    } catch {
      lastFrame.setFailed('Failed to process image')
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

  function activatePromptMode() {
    if (lastFrame.status === 'generating') return
    setLastFrameMode('prompt')
    setLastFrameImageData(null)
    setLastFrameOriginalData(null)
    lastFrame.reset()
    if (!lastFramePrompt.trim()) {
      handleSuggest()
    }
  }

  async function handleGenerate() {
    if (
      !accessToken ||
      !firstFrame.recordId ||
      firstFrame.status !== 'completed'
    )
      return

    const capturedFirstFrameUrl = firstFrame.url
    const capturedFirstFrameRecordId = firstFrame.recordId

    if (lastFrameMode === 'image') {
      if (!lastFrameImageData) return
      lastFrame.setGenerating()
      try {
        const result = await uploadVideoFrame({
          data: {
            imageBase64: lastFrameImageData,
            originalBase64: lastFrameOriginalData ?? undefined,
            frameType: 'last',
            accessToken,
          },
        })

        const gen = await createGeneration({
          data: {
            workspaceId,
            firstFrameId: capturedFirstFrameRecordId,
            lastFrameId: result.recordId,
            accessToken,
          },
        })

        const newGeneration: Generation = {
          id: gen.id,
          createdAt: new Date().toISOString(),
          firstFrame: {
            id: capturedFirstFrameRecordId,
            url: capturedFirstFrameUrl,
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
      return
    }

    if (!lastFramePrompt.trim()) return
    lastFrame.setGenerating()
    try {
      await credits.deduct(CREDIT_COSTS.last_frame, 'last_frame')
      const result = await generateLastFrame({
        data: {
          prompt: lastFramePrompt,
          firstFrameRecordId: capturedFirstFrameRecordId,
          model: LAST_FRAME_MODEL,
          accessToken,
          includeFirstFrame,
        },
      })

      const gen = await createGeneration({
        data: {
          workspaceId,
          firstFrameId: capturedFirstFrameRecordId,
          lastFrameId: result.recordId,
          accessToken,
        },
      })

      const newGeneration: Generation = {
        id: gen.id,
        createdAt: new Date().toISOString(),
        firstFrame: {
          id: capturedFirstFrameRecordId,
          url: capturedFirstFrameUrl,
          status: 'completed',
        },
        lastFrame: {
          id: result.recordId,
          url: null,
          status: 'pending',
        },
        video: null,
      }
      addGeneration(newGeneration)
      lastFrame.reset()
    } catch (err) {
      lastFrame.setFailed(
        err instanceof Error ? err.message : 'Failed to generate last frame',
      )
    }
  }

  async function handleSuggest() {
    if (!accessToken || firstFrame.status !== 'completed') return
    setSuggestingLastFrame(true)
    try {
      const result = await suggestLastFrame({
        data: {
          accessToken,
          firstFramePrompt: isImageMode ? '' : firstFramePrompt,
          firstFrameRecordId: firstFrame.recordId ?? undefined,
        },
      })
      setLastFramePrompt(result.prompt)
    } catch {
      // fail silently
    } finally {
      setSuggestingLastFrame(false)
    }
  }

  function resetLastFrameState() {
    setLastFramePrompt('')
    setLastFrameImageData(null)
    setLastFrameOriginalData(null)
  }

  return {
    lastFrameMode,
    lastFramePrompt,
    setLastFramePrompt,
    includeFirstFrame,
    setIncludeFirstFrame,
    lastFrameImageData,
    lastFrameOriginalData,
    suggestingLastFrame,
    generateDisabled,
    lastFrameLocked,
    setSourceFile,
    setSourceFromUrl,
    activatePromptMode,
    handleGenerate,
    handleSuggest,
    resetLastFrameState,
  }
}
