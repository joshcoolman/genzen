import { useRef, useState } from 'react'
import type { FrameMode } from '@/features/ai-video/types'
import type { CreditsState } from '@/features/credits/hooks/use-credits'
import { FIRST_FRAME_MODEL_FOR_MODE } from '@/features/ai-video/constants'
import { generateFirstFrame } from '@/features/ai-video/server/generate-first-frame.server'
import { uploadVideoFrame } from '@/features/ai-video/server/upload-video-frame.server'
import { suggestPrompt } from '@/lib/server/suggest-prompt.server'
import { CREDIT_COSTS } from '@/features/credits'
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
  firstFrameFileInputRef: React.RefObject<HTMLInputElement | null>
  handleModeChange: (mode: FrameMode) => void
  handleFilePick: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleGenerate: () => Promise<void>
  handleSuggest: () => Promise<void>
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
  const firstFrameFileInputRef = useRef<HTMLInputElement>(null)

  const firstFrameModel = FIRST_FRAME_MODEL_FOR_MODE[firstFrameMode]

  function handleModeChange(mode: FrameMode) {
    if (firstFrame.status === 'generating') return
    setFirstFrameMode(mode)
    firstFrame.reset()
    onResetDownstream()
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !accessToken) return
    e.target.value = ''

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

  async function handleGenerate() {
    if (!accessToken || !firstFramePrompt.trim()) return
    firstFrame.setGenerating()
    onResetDownstream()
    try {
      await credits.deduct(CREDIT_COSTS.first_frame, 'first_frame')
      const result = await generateFirstFrame({
        data: { prompt: firstFramePrompt, model: firstFrameModel, accessToken },
      })
      firstFrame.setRecordId(result.recordId)
    } catch (err) {
      firstFrame.setFailed(
        err instanceof Error ? err.message : 'Failed to generate first frame',
      )
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
    firstFrameFileInputRef,
    handleModeChange,
    handleFilePick,
    handleGenerate,
    handleSuggest,
  }
}
