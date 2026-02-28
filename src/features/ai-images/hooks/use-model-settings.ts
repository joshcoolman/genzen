import { useEffect, useMemo, useState } from 'react'
import type { PromptTheme } from '@/lib/prompt-components/prompt-types'
import {
  ALL_IMAGE_MODELS,
  DEFAULT_MODEL,
  DEFAULT_VISIBLE_MODELS,
  getVisibleModels,
} from '@/features/ai-images/models'

export function useModelSettings() {
  const [selectedModels, setSelectedModels] = useState<Array<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ai-image-selected-models')
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Array<string>
          const validIds = parsed.filter((id) =>
            ALL_IMAGE_MODELS.some((m) => m.id === id),
          )
          if (validIds.length > 0) return validIds
        } catch {
          // Fall through to default
        }
      }
    }
    return [DEFAULT_MODEL]
  })

  const [visibleModelIds, setVisibleModelIds] = useState<Array<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('genzen:visible-models')
        if (stored) {
          const parsed = JSON.parse(stored) as Array<string>
          const validIds = parsed.filter((id) =>
            ALL_IMAGE_MODELS.some((m) => m.id === id),
          )
          if (validIds.length > 0) return validIds
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_VISIBLE_MODELS.map((m) => m.id)
  })

  const [theme, setTheme] = useState<PromptTheme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ai-image-theme')
      if (stored === 'fantasy-scifi') return 'fantasy-scifi'
    }
    return 'general'
  })

  const [settingsOpen, setSettingsOpen] = useState(false)

  const visibleModels = useMemo(
    () => getVisibleModels(visibleModelIds),
    [visibleModelIds],
  )

  // Persist model selections
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'ai-image-selected-models',
        JSON.stringify(selectedModels),
      )
    }
  }, [selectedModels])

  // Persist visible models
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'genzen:visible-models',
        JSON.stringify(visibleModelIds),
      )
    }
  }, [visibleModelIds])

  // Persist theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-image-theme', theme)
    }
  }, [theme])

  // Auto-update selected models when visible set changes
  useEffect(() => {
    const validSelections = selectedModels.filter((id) =>
      visibleModelIds.includes(id),
    )
    if (validSelections.length === 0 && visibleModelIds.length > 0) {
      setSelectedModels([visibleModelIds[0]])
    } else if (validSelections.length !== selectedModels.length) {
      setSelectedModels(validSelections)
    }
  }, [visibleModelIds, selectedModels])

  return {
    selectedModels,
    setSelectedModels,
    visibleModelIds,
    setVisibleModelIds,
    visibleModels,
    theme,
    setTheme,
    settingsOpen,
    setSettingsOpen,
  }
}
