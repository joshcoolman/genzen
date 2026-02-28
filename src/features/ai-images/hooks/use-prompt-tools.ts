import { useState } from 'react'
import { generatePromptServer } from '@/features/ai-images/server/generate-prompt.server'
import { generatePromptEnhanced } from '@/features/ai-images/server/generate-prompt-enhanced.server'

interface UsePromptToolsOptions {
  accessToken: string | undefined
  setPrompt: (prompt: string) => void
  getPrompt: () => string
  setError: (error: string | null) => void
}

export interface PromptToolsState {
  generatingPrompt: boolean
  handleRandomPrompt: () => Promise<void>
  handleEnhancedPrompt: () => Promise<void>
}

export function usePromptTools({
  accessToken,
  setPrompt,
  getPrompt,
  setError,
}: UsePromptToolsOptions): PromptToolsState {
  const [generatingPrompt, setGeneratingPrompt] = useState(false)

  async function handleRandomPrompt() {
    if (generatingPrompt || !accessToken) return
    setGeneratingPrompt(true)
    setError(null)
    try {
      const data = await generatePromptServer({
        data: { accessToken, theme: 'general' },
      })
      setPrompt(data.prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  async function handleEnhancedPrompt() {
    const currentPrompt = getPrompt()
    if (generatingPrompt || !accessToken || !currentPrompt.trim()) return
    setGeneratingPrompt(true)
    setError(null)
    try {
      const data = await generatePromptEnhanced({
        data: {
          accessToken,
          currentPrompt: currentPrompt.trim(),
        },
      })
      setPrompt(data.prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance prompt')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  return {
    generatingPrompt,
    handleRandomPrompt,
    handleEnhancedPrompt,
  }
}
