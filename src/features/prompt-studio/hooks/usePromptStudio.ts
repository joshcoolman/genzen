import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_NEGATIVE_PROMPT, DEFAULT_SYSTEM_PROMPT } from '../types'
import { runSingleModel } from '../server/run-prompt-studio.server'
import { usePromptSets } from './usePromptSets'
import type { ModelResult } from '../types'
import { useAuth } from '@/lib/auth'
import { useEnabledModels } from '@/lib/use-enabled-models'
import { usePersistedBlob } from '@/lib/hooks/use-persisted-blob'

const SESSION_KEY = 'prompt-studio:session'
const OLD_SETTINGS_KEY = 'prompt-studio-settings'

const DEFAULT_PROMPT =
  'A dynamic full body shot of an unusual hero in an interesting setting, establishing shot, suitable for the first frame of a photorealistic video sequence'

interface PendingRun {
  prompt: string
  systemPrompt: string
  modelIds: Array<string>
  hasImage: boolean
}

interface PersistedSession {
  prompt: string
  customSystemPrompt: string
  negativePrompt: string
  selectedModelIds: Array<string>
  results: Array<ModelResult>
  sidebarOpen: boolean
  activeSetId: string | null
  pendingRun?: PendingRun | null
}

function loadSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}

  // Migration: read old key for system/negative prompt
  try {
    const old = localStorage.getItem(OLD_SETTINGS_KEY)
    if (old) {
      const parsed = JSON.parse(old) as {
        systemPrompt?: string
        negativePrompt?: string
      }
      return {
        prompt: DEFAULT_PROMPT,
        customSystemPrompt: parsed.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        negativePrompt: parsed.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
        selectedModelIds: [],
        results: [],
        sidebarOpen: false,
        activeSetId: null,
      }
    }
  } catch {}

  return null
}

function saveSession(data: PersistedSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {}
}

export function usePromptStudio() {
  const { session } = useAuth()
  const { enabledTextModels } = useEnabledModels()
  const savedSession = useMemo(() => loadSession(), [])

  // Intersect persisted model IDs with currently enabled models
  const initialModelIds = useMemo(() => {
    const enabledIds = enabledTextModels.map((m) => m.id)
    if (savedSession?.selectedModelIds.length) {
      const valid = savedSession.selectedModelIds.filter((id) =>
        enabledIds.includes(id),
      )
      return valid.length > 0 ? valid : enabledIds
    }
    return enabledIds
  }, [])

  const [prompt, setPrompt] = useState(savedSession?.prompt ?? DEFAULT_PROMPT)
  const [customSystemPrompt, setCustomSystemPrompt] = useState(
    savedSession?.customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  )
  const [negativePrompt, setNegativePrompt] = useState(
    savedSession?.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
  )
  const [selectedModelIds, setSelectedModelIds] =
    useState<Array<string>>(initialModelIds)
  const [results, setResults] = useState<Array<ModelResult>>(
    savedSession?.results ?? [],
  )
  const [pendingModelIds, setPendingModelIds] = useState<Set<string>>(new Set())
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(
    savedSession?.pendingRun ?? null,
  )

  // Image state via IndexedDB
  const imageBlob = usePersistedBlob<{ url: string; base64: string }>(
    'prompt-studio:image',
  )
  const imageUrl = imageBlob.data?.url ?? null
  const imageBase64 = imageBlob.data?.base64 ?? null

  // Prompt sets
  const promptSets = usePromptSets()
  const [sidebarOpen, setSidebarOpen] = useState(
    savedSession?.sidebarOpen ?? false,
  )

  // Restore active set ID on mount
  const didRestoreActiveSet = useRef(false)
  useEffect(() => {
    if (
      !didRestoreActiveSet.current &&
      savedSession?.activeSetId &&
      promptSets.getSet(savedSession.activeSetId)
    ) {
      promptSets.setActiveSetId(savedSession.activeSetId)
      didRestoreActiveSet.current = true
    }
  }, [promptSets, savedSession?.activeSetId])

  // Derived
  const running = pendingModelIds.size > 0

  // Debounced session persistence
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveSession({
        prompt,
        customSystemPrompt,
        negativePrompt,
        selectedModelIds,
        results,
        sidebarOpen,
        activeSetId: promptSets.activeSetId,
        pendingRun,
      })
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [
    prompt,
    customSystemPrompt,
    negativePrompt,
    selectedModelIds,
    results,
    sidebarOpen,
    promptSets.activeSetId,
    pendingRun,
  ])

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
    imageBlob.clear()
    setSelectedModelIds(enabledTextModels.map((m) => m.id))
    promptSets.setActiveSetId(null)
  }, [promptSets, enabledTextModels, imageBlob])

  const setImage = useCallback(
    (url: string, base64: string) => {
      imageBlob.set({ url, base64 })
      // Auto-deselect non-vision models
      const visionIds = enabledTextModels
        .filter((m) => m.supportsVision)
        .map((m) => m.id)
      setSelectedModelIds((prev) => prev.filter((id) => visionIds.includes(id)))
    },
    [enabledTextModels, imageBlob],
  )

  const clearImage = useCallback(() => {
    imageBlob.clear()
  }, [imageBlob])

  const toggleModel = useCallback(
    (id: string) => {
      if (imageBase64) {
        const model = enabledTextModels.find((m) => m.id === id)
        if (model && !model.supportsVision) return
      }
      setSelectedModelIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      )
    },
    [imageBase64, enabledTextModels],
  )

  // Fire models helper -- used by both run() and resume
  const fireModels = useCallback(
    (
      modelIds: Array<string>,
      runPrompt: string,
      runSystemPrompt: string,
      accessToken: string,
      runImageBase64: string | null,
    ) => {
      setPendingModelIds((prev) => {
        const next = new Set(prev)
        for (const id of modelIds) next.add(id)
        return next
      })

      for (const modelId of modelIds) {
        runSingleModel({
          data: {
            prompt: runPrompt,
            systemPrompt: runSystemPrompt,
            modelId,
            accessToken,
            imageBase64: runImageBase64,
          },
        })
          .then((result) => {
            setResults((prev) => [...prev, result])
            setPendingModelIds((prev) => {
              const next = new Set(prev)
              next.delete(modelId)
              return next
            })
          })
          .catch((err) => {
            setResults((prev) => [
              ...prev,
              {
                modelId,
                text: null,
                error: err instanceof Error ? err.message : 'Unknown error',
                durationMs: 0,
              },
            ])
            setPendingModelIds((prev) => {
              const next = new Set(prev)
              next.delete(modelId)
              return next
            })
          })
      }
    },
    [],
  )

  // Resume incomplete run on mount
  const didResume = useRef(false)
  useEffect(() => {
    if (didResume.current || !pendingRun || !session) return
    // If run needed an image, wait for blob to load
    if (pendingRun.hasImage && imageBlob.loading) return

    const completedIds = new Set(results.map((r) => r.modelId))
    const missingIds = pendingRun.modelIds.filter((id) => !completedIds.has(id))

    if (missingIds.length === 0) {
      // All done, clear pending run
      setPendingRun(null)
      didResume.current = true
      return
    }

    didResume.current = true
    const imgData = pendingRun.hasImage ? imageBase64 : null
    fireModels(
      missingIds,
      pendingRun.prompt,
      pendingRun.systemPrompt,
      session.access_token,
      imgData,
    )
  }, [pendingRun, session, imageBlob.loading, imageBase64, results, fireModels])

  // Clear pendingRun when all models complete
  useEffect(() => {
    if (!pendingRun) return
    const completedIds = new Set(results.map((r) => r.modelId))
    const allDone = pendingRun.modelIds.every((id) => completedIds.has(id))
    if (allDone) setPendingRun(null)
  }, [results, pendingRun])

  const run = useCallback(() => {
    if (!prompt.trim() || selectedModelIds.length === 0 || !session) return

    let systemPrompt = customSystemPrompt
    if (negativePrompt.trim()) {
      systemPrompt += `\n\nNEVER use these words or phrases: ${negativePrompt.trim()}`
    }

    const runConfig: PendingRun = {
      prompt: prompt.trim(),
      systemPrompt,
      modelIds: selectedModelIds,
      hasImage: !!imageBase64,
    }

    setResults([])
    setPendingRun(runConfig)
    didResume.current = true // prevent resume effect from double-firing

    fireModels(
      selectedModelIds,
      runConfig.prompt,
      runConfig.systemPrompt,
      session.access_token,
      imageBase64,
    )
  }, [
    prompt,
    customSystemPrompt,
    negativePrompt,
    selectedModelIds,
    session,
    imageBase64,
    fireModels,
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
    pendingModelIds,
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
    enabledTextModels,
    sidebarOpen,
    setSidebarOpen,
  }
}

export type UsePromptStudioReturn = ReturnType<typeof usePromptStudio>
