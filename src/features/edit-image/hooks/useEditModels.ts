import { useCallback, useState } from 'react'
import { DEFAULT_EDIT_MODEL, EDIT_MODELS } from '@/features/ai-images/models'

export function useEditModels() {
  const [selectedModelIds, setSelectedModelIds] = useState<Array<string>>([
    DEFAULT_EDIT_MODEL,
  ])
  const [generationsPerModel, setGenerationsPerModel] = useState(1)

  const toggleModel = useCallback((id: string) => {
    setSelectedModelIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev // must keep at least 1
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }, [])

  const adjustGenerations = useCallback((delta: number) => {
    setGenerationsPerModel((prev) => Math.min(Math.max(prev + delta, 1), 3))
  }, [])

  const selectedModels = EDIT_MODELS.filter((m) =>
    selectedModelIds.includes(m.id),
  )

  const maxRefImages =
    selectedModels.length === 0
      ? 0
      : Math.min(...selectedModels.map((m) => m.maxRefImages))

  return {
    selectedModelIds,
    selectedModels,
    toggleModel,
    maxRefImages,
    generationsPerModel,
    adjustGenerations,
  }
}
