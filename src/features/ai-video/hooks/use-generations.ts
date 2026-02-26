import { useCallback, useEffect, useState } from 'react'
import type { Generation } from '../types'
import { getGenerations } from '@/features/ai-video/server/get-generations.server'

export function useGenerations(
  workspaceId: string,
  accessToken: string | undefined,
) {
  const [generations, setGenerations] = useState<Array<Generation>>([])
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    getGenerations({
      data: { workspaceId, accessToken },
    })
      .then(setGenerations)
      .catch(() => {})
  }, [workspaceId, accessToken])

  const addGeneration = useCallback((gen: Generation) => {
    setGenerations((prev) => [gen, ...prev])
  }, [])

  const updateGeneration = useCallback(
    (id: string, updates: Partial<Generation>) => {
      setGenerations((prev) =>
        prev.map((gen) => (gen.id === id ? { ...gen, ...updates } : gen)),
      )
    },
    [],
  )

  const deleteGeneration = useCallback((id: string) => {
    setGenerations((prev) => prev.filter((gen) => gen.id !== id))
  }, [])

  const removeByIds = useCallback((ids: Set<string>) => {
    setGenerations((prev) => prev.filter((g) => !ids.has(g.id)))
  }, [])

  return {
    generations,
    isGeneratingVideo,
    setIsGeneratingVideo,
    addGeneration,
    updateGeneration,
    deleteGeneration,
    removeByIds,
  }
}
