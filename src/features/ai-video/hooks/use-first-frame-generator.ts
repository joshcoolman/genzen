import { useState } from 'react'
import type { FrameMode } from '@/features/ai-video/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { FIRST_FRAME_MODEL_FOR_MODE } from '@/features/ai-video/constants'
import { generateFirstFrame } from '@/features/ai-video/server/generate-first-frame.server'
import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { suggestPrompt } from '@/lib/server/suggest-prompt.server'
import { CREDIT_COSTS } from '@/features/credits'
import { isCreditError } from '@/features/credits/handle-credit-error'
import { cropTo16x9, fileToBase64 } from '@/features/ai-video/lib/crop-to-16x9'

interface UseFirstFrameGeneratorOptions {
  accessToken: string | undefined
  credits: CreditsState
  firstFrame: {
    status: string
    reset: () => void
    setGenerating: (previewUrl?: string) => void
    setCompleted: (url: string, recordId: string) => void
    setFailed: (msg: string) => void
    setRecordId: (id: string) => void
  }
  firstFrameMode: FrameMode
  setFirstFrameMode: (mode: FrameMode) => void
  onResetDownstream: () => void
}

export interface FirstFrameGeneratorState {
  firstFramePrompt: string
  setFirstFramePrompt: (prompt: string) => void
  suggestingFirstFrame: boolean
  firstFrameModel: string
  handleGenerate: () => Promise<void>
  handleSuggest: () => Promise<void>
  setSourceFile: (file: File) => void
  setSourceFromUrl: (url: string, name: string) => void
  activatePromptMode: () => void
}

export function useFirstFrameGenerator({
  accessToken,
  credits,
  firstFrame,
  firstFrameMode,
  setFirstFrameMode,
  onResetDownstream,
}: UseFirstFrameGeneratorOptions): FirstFrameGeneratorState {
  const [firstFramePrompt, setFirstFramePrompt] = useState('')
  const [suggestingFirstFrame, setSuggestingFirstFrame] = useState(false)

  const firstFrameModel = FIRST_FRAME_MODEL_FOR_MODE[firstFrameMode]

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

    setFirstFrameMode('image')
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

  function activatePromptMode() {
    if (firstFrame.status === 'generating') return
    setFirstFrameMode('prompt')
    firstFrame.reset()
    onResetDownstream()
    if (!firstFramePrompt.trim()) {
      handleSuggest()
    }
  }

  async function handleGenerate() {
    if (!accessToken || !firstFramePrompt.trim()) return

    const cost = CREDIT_COSTS.first_frame
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      return
    }

    firstFrame.setGenerating()
    onResetDownstream()
    try {
      await credits.deduct(cost, 'first_frame')
      const result = await generateFirstFrame({
        data: { prompt: firstFramePrompt, model: firstFrameModel, accessToken },
      })
      firstFrame.setRecordId(result.recordId)
    } catch (err) {
      if (isCreditError(err)) {
        credits.showInsufficientCredits(cost)
      } else {
        firstFrame.setFailed(
          err instanceof Error ? err.message : 'Failed to generate first frame',
        )
      }
    }
  }

  async function handleSuggest() {
    if (!accessToken) return
    setSuggestingFirstFrame(true)
    try {
      const result = await suggestPrompt({
        data: { accessToken, context: 'video-first-frame' },
      })
      setFirstFramePrompt(result.prompt)
    } catch {
      // fail silently
    } finally {
      setSuggestingFirstFrame(false)
    }
  }

  return {
    firstFramePrompt,
    setFirstFramePrompt,
    suggestingFirstFrame,
    firstFrameModel,
    handleGenerate,
    handleSuggest,
    setSourceFile,
    setSourceFromUrl,
    activatePromptMode,
  }
}
