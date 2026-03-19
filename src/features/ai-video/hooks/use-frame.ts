import { useCallback, useEffect, useRef, useState } from 'react'
import type { FrameState, FrameStatus } from '../types'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

interface UseFrameOptions {
  accessToken: string | undefined
}

export function useFrame({ accessToken }: UseFrameOptions) {
  const [status, setStatus] = useState<FrameStatus>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setUrl(null)
    setRecordId(null)
    setError(null)
  }, [])

  const setGenerating = useCallback((previewUrl?: string) => {
    setStatus('generating')
    setUrl(previewUrl ?? null)
    setRecordId(null)
    setError(null)
  }, [])

  const setCompleted = useCallback(
    (frameUrl: string, frameRecordId: string) => {
      setStatus('completed')
      setUrl(frameUrl)
      setRecordId(frameRecordId)
      setError(null)
    },
    [],
  )

  const setFailed = useCallback((msg: string) => {
    setStatus('error')
    setError(msg)
  }, [])

  const setRecordIdOnly = useCallback((id: string) => {
    setRecordId(id)
  }, [])

  // Realtime subscription for frame record updates
  useEffect(() => {
    if (status !== 'generating' || !recordId || !accessToken) return

    const channel = supabase
      .channel(`frame_${recordId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_images',
          filter: `id=eq.${recordId}`,
        },
        (payload) => {
          const updated = payload.new as {
            status: string
            storage_path: string | null
          }
          if (updated.status === 'completed' && updated.storage_path) {
            supabase.storage
              .from('user-images')
              .createSignedUrl(updated.storage_path, 86400)
              .then(({ data }) => {
                if (data) {
                  setUrl(data.signedUrl)
                  setStatus('completed')
                }
              })
              .catch(() => {})
          } else if (updated.status === 'failed') {
            setStatus('error')
            setError('Frame generation failed')
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [status, recordId, accessToken])

  // Poll FAL for pending frame generation
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (status !== 'generating' || !recordId || !accessToken) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    checkPendingGenerations({ data: { accessToken } }).catch(() => {})
    pollingRef.current = setInterval(() => {
      checkPendingGenerations({ data: { accessToken } }).catch(() => {})
    }, 5000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [status, recordId, accessToken])

  const state: FrameState = { status, url, recordId, error }

  return {
    ...state,
    setStatus,
    setUrl,
    reset,
    setGenerating,
    setCompleted,
    setFailed,
    setRecordId: setRecordIdOnly,
  }
}
