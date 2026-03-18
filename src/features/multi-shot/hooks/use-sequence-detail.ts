import { useCallback, useEffect, useRef, useState } from 'react'
import { getSequence } from '../server/get-sequence.server'
import { getSequenceGenerations } from '../server/get-sequence-generations.server'
import { deleteGeneration } from '../server/delete-generation.server'
import { useMultishotEditor } from './use-multishot-editor'
import type { GenerationRecord } from '../types'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

interface UseSequenceDetailOptions {
  accessToken: string | undefined
  sequenceId: string
}

export function useSequenceDetail({
  accessToken,
  sequenceId,
}: UseSequenceDetailOptions) {
  const [generations, setGenerations] = useState<Array<GenerationRecord>>([])
  const [generationsLoading, setGenerationsLoading] = useState(true)
  const [sequenceLoading, setSequenceLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const elementsLocked = generations.length > 0

  const editor = useMultishotEditor({
    accessToken,
    elementsLocked,
    onGenerated: () => refreshGenerations(),
  })

  const refreshGenerations = useCallback(async () => {
    if (!accessToken) return
    try {
      await checkPendingGenerations({ data: { accessToken } }).catch(() => {})
      const result = await getSequenceGenerations({
        data: { accessToken, sequenceId },
      })
      setGenerations(result)
    } catch {
      // silent
    } finally {
      setGenerationsLoading(false)
    }
  }, [accessToken, sequenceId])

  // Load sequence on mount
  useEffect(() => {
    if (!accessToken || sequenceId === 'new') {
      setSequenceLoading(false)
      setGenerationsLoading(false)
      return
    }

    const controller = new AbortController()
    ;(async () => {
      try {
        const seq = await getSequence({
          data: { accessToken, sequenceId },
        })
        if (!controller.signal.aborted) {
          editor.loadSequence(seq)
        }
      } catch {
        // sequence not found
      } finally {
        if (!controller.signal.aborted) setSequenceLoading(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [accessToken, sequenceId])

  // Load generations
  useEffect(() => {
    if (sequenceId === 'new') return
    refreshGenerations()
  }, [sequenceId, refreshGenerations])

  // Poll when pending
  useEffect(() => {
    const hasPending = generations.some(
      (g) => g.status === 'pending' || g.status === 'processing',
    )
    if (hasPending) {
      pollRef.current = setInterval(refreshGenerations, 5000)
    } else if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [generations, refreshGenerations])

  const handleDeleteGeneration = useCallback(
    async (generationId: string) => {
      if (!accessToken) return
      await deleteGeneration({ data: { accessToken, generationId } })
      setGenerations((prev) => prev.filter((g) => g.id !== generationId))
    },
    [accessToken],
  )

  return {
    editor,
    generations,
    generationsLoading,
    sequenceLoading,
    elementsLocked,
    handleDeleteGeneration,
  }
}
