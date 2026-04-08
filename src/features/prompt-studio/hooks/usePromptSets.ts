import { useCallback, useEffect, useRef, useState } from 'react'
import { listSets } from '../server/list-sets.server'
import { saveSet } from '../server/save-set.server'
import { updateSet as updateSetServer } from '../server/update-set.server'
import { deleteSet as deleteSetServer } from '../server/delete-set.server'
import { migrateSets } from '../server/migrate-sets.server'
import type { PromptSet } from '../types'
import { useAuth } from '@/lib/auth'

const LEGACY_KEY = 'prompt-studio-sets'

interface DbRow {
  id: string
  name: string
  prompt: string
  system_prompt: string
  negative_prompt: string
  selected_model_ids: Array<string> | null
  created_at: string
  updated_at: string
}

function rowToSet(row: DbRow): PromptSet {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    systemPrompt: row.system_prompt,
    negativePrompt: row.negative_prompt,
    selectedModelIds: row.selected_model_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function loadLegacySets(): Array<PromptSet> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    return parsed.map((s) => ({
      id: String(s.id ?? ''),
      name: String(s.name ?? ''),
      prompt: String(s.prompt ?? ''),
      systemPrompt: String(s.systemPrompt ?? ''),
      negativePrompt: String(s.negativePrompt ?? ''),
      selectedModelIds: Array.isArray(s.selectedModelIds)
        ? (s.selectedModelIds as Array<string>)
        : [],
      createdAt: String(s.createdAt ?? new Date().toISOString()),
      updatedAt: String(s.updatedAt ?? new Date().toISOString()),
    }))
  } catch {
    return []
  }
}

export function usePromptSets() {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [sets, setSets] = useState<Array<PromptSet>>([])
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const didInit = useRef(false)

  // Fetch from Supabase + migrate localStorage on mount
  useEffect(() => {
    if (!accessToken || didInit.current) return
    didInit.current = true

    const init = async () => {
      try {
        const result = await listSets({ data: { accessToken } })
        const dbSets = (result.sets as Array<DbRow>).map(rowToSet)

        // Check for localStorage data to migrate
        const legacySets = loadLegacySets()
        if (legacySets.length > 0) {
          const dbIds = new Set(dbSets.map((s) => s.id))
          const toMigrate = legacySets.filter((s) => !dbIds.has(s.id))

          if (toMigrate.length > 0) {
            try {
              await migrateSets({ data: { accessToken, sets: toMigrate } })
              // Re-fetch to get canonical server data
              const refreshed = await listSets({ data: { accessToken } })
              const refreshedSets = (refreshed.sets as Array<DbRow>).map(
                rowToSet,
              )
              setSets(refreshedSets)
            } catch {
              // Migration failed, keep DB data + local data merged
              setSets([...dbSets, ...toMigrate])
            }
          } else {
            setSets(dbSets)
          }
          // Clear localStorage regardless (all sets are either in DB or merged)
          try {
            localStorage.removeItem(LEGACY_KEY)
          } catch {}
        } else {
          setSets(dbSets)
        }
      } catch {
        // Fallback to localStorage if Supabase fails
        setSets(loadLegacySets())
      }
      setIsLoaded(true)
    }

    init()
  }, [accessToken])

  const saveNewSet = useCallback(
    (
      name: string,
      prompt: string,
      systemPrompt: string,
      negativePrompt: string,
      selectedModelIds: Array<string> = [],
    ) => {
      if (!accessToken) return null

      // Optimistic: add immediately
      const tempId = crypto.randomUUID()
      const now = new Date().toISOString()
      const optimistic: PromptSet = {
        id: tempId,
        name,
        prompt,
        systemPrompt,
        negativePrompt,
        selectedModelIds,
        createdAt: now,
        updatedAt: now,
      }
      setSets((prev) => [optimistic, ...prev])
      setActiveSetId(tempId)

      // Persist to Supabase
      saveSet({
        data: {
          accessToken,
          name,
          prompt,
          systemPrompt,
          negativePrompt,
          selectedModelIds,
        },
      })
        .then((result) => {
          const created = rowToSet(result.set as DbRow)
          setSets((prev) => prev.map((s) => (s.id === tempId ? created : s)))
          setActiveSetId(created.id)
        })
        .catch(() => {
          // Revert on failure
          setSets((prev) => prev.filter((s) => s.id !== tempId))
          setActiveSetId(null)
        })

      return optimistic
    },
    [accessToken],
  )

  const updateSet = useCallback(
    (
      id: string,
      prompt: string,
      systemPrompt: string,
      negativePrompt: string,
      selectedModelIds?: Array<string>,
    ) => {
      if (!accessToken) return

      // Optimistic update
      setSets((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                prompt,
                systemPrompt,
                negativePrompt,
                ...(selectedModelIds !== undefined && { selectedModelIds }),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      )

      updateSetServer({
        data: {
          accessToken,
          id,
          prompt,
          systemPrompt,
          negativePrompt,
          ...(selectedModelIds !== undefined && { selectedModelIds }),
        },
      }).catch(() => {
        // Re-fetch on failure
        listSets({ data: { accessToken } }).then((result) => {
          setSets((result.sets as Array<DbRow>).map(rowToSet))
        })
      })
    },
    [accessToken],
  )

  const deleteSet = useCallback(
    (id: string) => {
      if (!accessToken) return

      const prev = sets
      setSets((s) => s.filter((x) => x.id !== id))
      if (activeSetId === id) setActiveSetId(null)

      deleteSetServer({ data: { accessToken, id } }).catch(() => {
        setSets(prev)
      })
    },
    [accessToken, sets, activeSetId],
  )

  const renameSet = useCallback(
    (id: string, name: string) => {
      if (!accessToken) return

      setSets((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s,
        ),
      )

      updateSetServer({ data: { accessToken, id, name } }).catch(() => {
        listSets({ data: { accessToken } }).then((result) => {
          setSets((result.sets as Array<DbRow>).map(rowToSet))
        })
      })
    },
    [accessToken],
  )

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
    isLoaded,
  }
}
