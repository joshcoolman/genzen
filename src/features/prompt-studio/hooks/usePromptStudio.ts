import { useCallback, useEffect, useMemo, useState } from 'react'
import { TEXT_MODELS } from '../text-models'
import { DEFAULT_NEGATIVE_PROMPT, DEFAULT_SYSTEM_PROMPT } from '../types'
import { runPromptStudio } from '../server/run-prompt-studio.server'
import { usePromptSets } from './usePromptSets'
import type { ModelResult } from '../types'
import { useAuth } from '@/lib/auth'

const STORAGE_KEY = 'prompt-studio-settings'
const DEFAULT_PROMPT =
  'A dynamic full body shot of an unusual hero in an interesting setting, establishing shot, suitable for the first frame of a photorealistic video sequence'

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

export function usePromptStudio() {
  const { session } = useAuth()
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)

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

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)

  // Prompt sets
  const promptSets = usePromptSets()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Persist system prompt and negative prompt changes
  useEffect(() => {
    save(customSystemPrompt, negativePrompt)
  }, [customSystemPrompt, negativePrompt])

  const isSystemPromptModified = customSystemPrompt !== DEFAULT_SYSTEM_PROMPT
  const isNegativePromptModified = negativePrompt !== DEFAULT_NEGATIVE_PROMPT

  // Dirty check against active set
  const isDirty = useMemo(() => {
    if (!promptSets.activeSetId) return false
    const activeSet = promptSets.getSet(promptSets.activeSetId)
    if (!activeSet) return false
    return (
      prompt !== activeSet.prompt ||
      customSystemPrompt !== activeSet.systemPrompt ||
      negativePrompt !== activeSet.negativePrompt
    )
  }, [prompt, customSystemPrompt, negativePrompt, promptSets])

  const restoreDefaults = useCallback(() => {
    setCustomSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    setNegativePrompt(DEFAULT_NEGATIVE_PROMPT)
    setImageUrl(null)
    setImageBase64(null)
    setSelectedModelIds(TEXT_MODELS.map((m) => m.id))
    promptSets.setActiveSetId(null)
  }, [promptSets])

  const setImage = useCallback((url: string, base64: string) => {
    setImageUrl(url)
    setImageBase64(base64)
    // Auto-deselect non-vision models
    const visionIds = TEXT_MODELS.filter((m) => m.supportsVision).map(
      (m) => m.id,
    )
    setSelectedModelIds((prev) => prev.filter((id) => visionIds.includes(id)))
  }, [])

  const clearImage = useCallback(() => {
    setImageUrl(null)
    setImageBase64(null)
  }, [])

  const toggleModel = useCallback(
    (id: string) => {
      // Prevent selecting non-vision models when image is attached
      if (imageBase64) {
        const model = TEXT_MODELS.find((m) => m.id === id)
        if (model && !model.supportsVision) return
      }
      setSelectedModelIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      )
    },
    [imageBase64],
  )

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
          imageBase64,
        },
      })
      setResults(data)
    } catch (err) {
      console.error('Prompt studio error:', err)
    } finally {
      setRunning(false)
    }
  }, [
    prompt,
    customSystemPrompt,
    negativePrompt,
    selectedModelIds,
    session,
    imageBase64,
  ])

  // Prompt set actions
  const loadSet = useCallback(
    (id: string) => {
      const set = promptSets.getSet(id)
      if (!set) return
      setPrompt(set.prompt)
      setCustomSystemPrompt(set.systemPrompt)
      setNegativePrompt(set.negativePrompt)
      promptSets.setActiveSetId(id)
    },
    [promptSets],
  )

  const saveAsNew = useCallback(
    (name: string) => {
      promptSets.saveNewSet(name, prompt, customSystemPrompt, negativePrompt)
    },
    [prompt, customSystemPrompt, negativePrompt, promptSets],
  )

  const updateCurrentSet = useCallback(() => {
    if (!promptSets.activeSetId) return
    promptSets.updateSet(
      promptSets.activeSetId,
      prompt,
      customSystemPrompt,
      negativePrompt,
    )
  }, [prompt, customSystemPrompt, negativePrompt, promptSets])

  return {
    prompt,
    setPrompt,
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
    // Image
    imageUrl,
    imageBase64,
    setImage,
    clearImage,
    // Prompt sets
    promptSets,
    activeSetId: promptSets.activeSetId,
    isDirty,
    loadSet,
    saveAsNew,
    updateCurrentSet,
    sidebarOpen,
    setSidebarOpen,
  }
}

export type UsePromptStudioReturn = ReturnType<typeof usePromptStudio>
