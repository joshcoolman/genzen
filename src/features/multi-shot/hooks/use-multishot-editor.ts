import { useCallback, useMemo, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  MAX_SHOTS,
  MAX_TOTAL_DURATION,
  MIN_SHOT_DURATION,
  PRICE_PER_SEC_AUDIO,
} from '../types'
import { saveSequence } from '../server/save-sequence.server'
import { generateMultishot } from '../server/generate-multishot.server'
import type { MultiShotElement, MultiShotSettings, Shot } from '../types'

interface UseMultishotEditorOptions {
  accessToken: string | undefined
  elementsLocked?: boolean
  onGenerated?: () => void
}

export function useMultishotEditor({
  accessToken,
  elementsLocked = false,
  onGenerated,
}: UseMultishotEditorOptions) {
  const [sequenceId, setSequenceId] = useState<string | null>(null)
  const [name, setName] = useState('Untitled')
  const [shots, setShots] = useState<Array<Shot>>([
    { id: crypto.randomUUID(), prompt: '', duration: 5 },
  ])
  const [elements, setElements] = useState<Array<MultiShotElement>>([])
  const [settings, setSettings] = useState<MultiShotSettings>(DEFAULT_SETTINGS)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalDuration = useMemo(
    () => shots.reduce((sum, s) => sum + s.duration, 0),
    [shots],
  )
  const remainingBudget = MAX_TOTAL_DURATION - totalDuration
  const canAddShot =
    shots.length < MAX_SHOTS && remainingBudget >= MIN_SHOT_DURATION

  const estimatedCost = useMemo(() => {
    if (settings.generateAudio) {
      return +(totalDuration * PRICE_PER_SEC_AUDIO).toFixed(2)
    }
    return +(totalDuration * 0.14).toFixed(2)
  }, [totalDuration, settings.generateAudio])

  const addShot = useCallback(() => {
    if (!canAddShot) return
    const duration = Math.min(5, remainingBudget)
    setShots((prev) => [
      ...prev,
      { id: crypto.randomUUID(), prompt: '', duration },
    ])
  }, [canAddShot, remainingBudget])

  const removeShot = useCallback((shotId: string) => {
    setShots((prev) =>
      prev.length <= 1 ? prev : prev.filter((s) => s.id !== shotId),
    )
  }, [])

  const updateShot = useCallback(
    (shotId: string, updates: Partial<Pick<Shot, 'prompt' | 'duration'>>) => {
      setShots((prev) =>
        prev.map((s) => {
          if (s.id !== shotId) return s
          const updated = { ...s, ...updates }
          // Clamp duration
          if (updates.duration !== undefined) {
            const otherDuration = prev
              .filter((o) => o.id !== shotId)
              .reduce((sum, o) => sum + o.duration, 0)
            const maxForThis = MAX_TOTAL_DURATION - otherDuration
            updated.duration = Math.max(
              MIN_SHOT_DURATION,
              Math.min(updates.duration, maxForThis),
            )
          }
          return updated
        }),
      )
    },
    [],
  )

  const addElement = useCallback(
    (frontalImageUrl: string) => {
      if (elementsLocked) return
      setElements((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          frontalImageUrl,
          label: `@Element${prev.length + 1}`,
        },
      ])
    },
    [elementsLocked],
  )

  const removeElement = useCallback(
    (elementId: string) => {
      if (elementsLocked) return
      setElements((prev) => {
        const filtered = prev.filter((e) => e.id !== elementId)
        // Re-label
        return filtered.map((e, i) => ({ ...e, label: `@Element${i + 1}` }))
      })
    },
    [elementsLocked],
  )

  const replaceElements = useCallback(
    (urls: Array<string>) => {
      if (elementsLocked) return
      setElements(
        urls.map((url, i) => ({
          id: crypto.randomUUID(),
          frontalImageUrl: url,
          label: `@Element${i + 1}`,
        })),
      )
    },
    [elementsLocked],
  )

  const loadSequence = useCallback(
    (seq: {
      id: string
      name: string
      shots: Array<Shot>
      elements: Array<MultiShotElement>
      settings: MultiShotSettings
    }) => {
      setSequenceId(seq.id)
      setName(seq.name)
      setShots(
        seq.shots.length > 0
          ? seq.shots
          : [{ id: crypto.randomUUID(), prompt: '', duration: 5 }],
      )
      setElements(seq.elements)
      setSettings({ ...DEFAULT_SETTINGS, ...seq.settings })
      setError(null)
    },
    [],
  )

  const resetEditor = useCallback(() => {
    setSequenceId(null)
    setName('Untitled')
    setShots([{ id: crypto.randomUUID(), prompt: '', duration: 5 }])
    setElements([])
    setSettings(DEFAULT_SETTINGS)
    setError(null)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!accessToken) return
    if (shots.length === 0 || shots.every((s) => !s.prompt.trim())) {
      setError('At least one shot needs a prompt')
      return
    }
    if (!settings.startImageUrl) {
      setError('A start image is required for multi-shot generation')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      // Save first
      const { id } = await saveSequence({
        data: {
          accessToken,
          id: sequenceId ?? undefined,
          name,
          shots,
          elements,
          settings,
        },
      })

      if (!sequenceId) setSequenceId(id)

      // Generate
      await generateMultishot({
        data: { accessToken, sequenceId: id },
      })

      onGenerated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [accessToken, sequenceId, name, shots, elements, settings, onGenerated])

  const handleSave = useCallback(async () => {
    if (!accessToken) return
    try {
      const { id } = await saveSequence({
        data: {
          accessToken,
          id: sequenceId ?? undefined,
          name,
          shots,
          elements,
          settings,
        },
      })
      if (!sequenceId) setSequenceId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }, [accessToken, sequenceId, name, shots, elements, settings])

  return {
    sequenceId,
    name,
    setName,
    shots,
    elements,
    settings,
    setSettings,
    totalDuration,
    remainingBudget,
    canAddShot,
    estimatedCost,
    generating,
    error,
    elementsLocked,
    addShot,
    removeShot,
    updateShot,
    addElement,
    removeElement,
    replaceElements,
    loadSequence,
    resetEditor,
    handleGenerate,
    handleSave,
  }
}
