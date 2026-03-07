import { useCallback, useEffect, useState } from 'react'
import { TEXT_MODELS } from '../text-models'
import { DEFAULT_NEGATIVE_PROMPT, PROMPT_MODES } from '../types'
import { runPromptStudio } from '../server/run-prompt-studio.server'
import type { ModelResult, PromptMode } from '../types'
import { useAuth } from '@/lib/auth'

const STORAGE_KEY = 'prompt-studio-settings'
const DEFAULT_PROMPT =
  'A dynamic full body shot of an unusual hero in an interesting setting, establishing shot, suitable for the first frame of a photorealistic video sequence'
const DEFAULT_SYSTEM_PROMPT =
  PROMPT_MODES.find((m) => m.id === 'image-prompt')?.systemPrompt ?? ''

function loadSaved(): {
  systemPrompt: string
  negativePrompt: string
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function save(systemPrompt: string, negativePrompt: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ systemPrompt, negativePrompt }),
    )
  } catch {
    // ignore
  }
}

export interface UsePromptStudioReturn {
  prompt: string
  setPrompt: (v: string) => void
  mode: PromptMode
  setMode: (v: PromptMode) => void
  customSystemPrompt: string
  setCustomSystemPrompt: (v: string) => void
  negativePrompt: string
  setNegativePrompt: (v: string) => void
  isSystemPromptModified: boolean
  isNegativePromptModified: boolean
  restoreDefaults: () => void
  selectedModelIds: Array<string>
  toggleModel: (id: string) => void
  results: Array<ModelResult>
  running: boolean
  run: () => void
}

export function usePromptStudio(): UsePromptStudioReturn {
  const { session } = useAuth()
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [mode, setModeRaw] = useState<PromptMode>('image-prompt')

  const saved = loadSaved()
  const [customSystemPrompt, setCustomSystemPrompt] = useState(
    saved?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  )
  const [negativePrompt, setNegativePrompt] = useState(
    saved?.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
  )
  const [selectedModelIds, setSelectedModelIds] = useState<Array<string>>(
    TEXT_MODELS.map((m) => m.id),
  )
  const [results, setResults] = useState<Array<ModelResult>>([])
  const [running, setRunning] = useState(false)

  // Persist system prompt and negative prompt changes
  useEffect(() => {
    save(customSystemPrompt, negativePrompt)
  }, [customSystemPrompt, negativePrompt])

  const isSystemPromptModified = customSystemPrompt !== DEFAULT_SYSTEM_PROMPT
  const isNegativePromptModified = negativePrompt !== DEFAULT_NEGATIVE_PROMPT

  const restoreDefaults = useCallback(() => {
    setCustomSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    setNegativePrompt(DEFAULT_NEGATIVE_PROMPT)
    setModeRaw('image-prompt')
  }, [])

  const setMode = useCallback((newMode: PromptMode) => {
    setModeRaw(newMode)
    const modeConfig = PROMPT_MODES.find((m) => m.id === newMode)
    setCustomSystemPrompt(modeConfig?.systemPrompt ?? '')
  }, [])

  const toggleModel = useCallback((id: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const run = useCallback(async () => {
    if (!prompt.trim() || selectedModelIds.length === 0 || !session) return

    setRunning(true)
    setResults([])

    try {
      let systemPrompt = customSystemPrompt

      if (negativePrompt.trim()) {
        systemPrompt += `\n\nNEVER use these words or phrases: ${negativePrompt.trim()}`
      }

      const data = await runPromptStudio({
        data: {
          prompt: prompt.trim(),
          systemPrompt,
          modelIds: selectedModelIds,
          accessToken: session.access_token,
        },
      })
      setResults(data)
    } catch (err) {
      console.error('Prompt studio error:', err)
    } finally {
      setRunning(false)
    }
  }, [prompt, customSystemPrompt, negativePrompt, selectedModelIds, session])

  return {
    prompt,
    setPrompt,
    mode,
    setMode,
    customSystemPrompt,
    setCustomSystemPrompt,
    negativePrompt,
    setNegativePrompt,
    isSystemPromptModified,
    isNegativePromptModified,
    restoreDefaults,
    selectedModelIds,
    toggleModel,
    results,
    running,
    run,
  }
}
