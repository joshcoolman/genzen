import { useCallback, useState } from 'react'
import type { PromptSet } from '../types'

const STORAGE_KEY = 'prompt-studio-sets'

function loadSets(): Array<PromptSet> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function persistSets(sets: Array<PromptSet>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets))
  } catch {
    // ignore
  }
}

export function usePromptSets() {
  const [sets, setSets] = useState<Array<PromptSet>>(loadSets)
  const [activeSetId, setActiveSetId] = useState<string | null>(null)

  const saveNewSet = useCallback(
    (
      name: string,
      prompt: string,
      systemPrompt: string,
      negativePrompt: string,
    ) => {
      const now = new Date().toISOString()
      const newSet: PromptSet = {
        id: crypto.randomUUID(),
        name,
        prompt,
        systemPrompt,
        negativePrompt,
        createdAt: now,
        updatedAt: now,
      }
      setSets((prev) => {
        const next = [newSet, ...prev]
        persistSets(next)
        return next
      })
      setActiveSetId(newSet.id)
      return newSet
    },
    [],
  )

  const updateSet = useCallback(
    (
      id: string,
      prompt: string,
      systemPrompt: string,
      negativePrompt: string,
    ) => {
      setSets((prev) => {
        const next = prev.map((s) =>
          s.id === id
            ? {
                ...s,
                prompt,
                systemPrompt,
                negativePrompt,
                updatedAt: new Date().toISOString(),
              }
            : s,
        )
        persistSets(next)
        return next
      })
    },
    [],
  )

  const deleteSet = useCallback(
    (id: string) => {
      setSets((prev) => {
        const next = prev.filter((s) => s.id !== id)
        persistSets(next)
        return next
      })
      if (activeSetId === id) setActiveSetId(null)
    },
    [activeSetId],
  )

  const renameSet = useCallback((id: string, name: string) => {
    setSets((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s,
      )
      persistSets(next)
      return next
    })
  }, [])

  const getSet = useCallback(
    (id: string) => sets.find((s) => s.id === id) ?? null,
    [sets],
  )

  return {
    sets,
    activeSetId,
    setActiveSetId,
    saveNewSet,
    updateSet,
    deleteSet,
    renameSet,
    getSet,
  }
}
