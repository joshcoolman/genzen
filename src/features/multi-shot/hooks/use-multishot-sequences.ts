import { useCallback, useEffect, useRef, useState } from 'react'
import { getSequences } from '../server/get-sequences.server'
import { deleteSequence } from '../server/delete-sequence.server'
import { duplicateSequence } from '../server/duplicate-sequence.server'
import type { MultiShotSequence } from '../types'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

interface UseMultishotSequencesOptions {
  accessToken: string | undefined
}

export function useMultishotSequences({
  accessToken,
}: UseMultishotSequencesOptions) {
  const [sequences, setSequences] = useState<Array<MultiShotSequence>>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    if (!accessToken) return
    try {
      // Check FAL status for any pending generations first
      await checkPendingGenerations({ data: { accessToken } }).catch(() => {})
      const result = await getSequences({ data: { accessToken } })
      setSequences(result)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Poll for pending sequences
  useEffect(() => {
    const hasPending = sequences.some(
      (s) => s.status === 'pending' || s.status === 'processing',
    )
    if (hasPending) {
      pollRef.current = setInterval(refresh, 5000)
    } else if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [sequences, refresh])

  const handleDelete = useCallback(
    async (sequenceId: string) => {
      if (!accessToken) return
      await deleteSequence({ data: { accessToken, sequenceId } })
      setSequences((prev) => prev.filter((s) => s.id !== sequenceId))
    },
    [accessToken],
  )

  const handleDuplicate = useCallback(
    async (sequenceId: string) => {
      if (!accessToken) return
      await duplicateSequence({ data: { accessToken, sequenceId } })
      await refresh()
    },
    [accessToken, refresh],
  )

  return {
    sequences,
    loading,
    refresh,
    handleDelete,
    handleDuplicate,
  }
}
