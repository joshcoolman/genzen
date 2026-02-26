import { useCallback, useEffect, useState } from 'react'
import type { FrameState, FrameStatus } from '../types'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import { supabase } from '@/lib/supabase'

interface UseFrameOptions {
  accessToken: string | undefined
  pollInterval?: number
  shouldPoll?: boolean
}

export function useFrame({
  accessToken,
  pollInterval = 3000,
  shouldPoll = true,
}: UseFrameOptions) {
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

  const checkFrame = useCallback(async () => {
    if (!accessToken || !recordId) return
    try {
      await checkPendingImages({
        data: { accessToken, recordIds: [recordId] },
      })
      const { data: recordData } = await supabase
        .from('user_images')
        .select('status, storage_path')
        .eq('id', recordId)
        .single()
      const record = recordData as {
        status: string
        storage_path: string | null
      } | null
      if (record?.status === 'completed' && record.storage_path) {
        const { data: urlData } = await supabase.storage
          .from('user-images')
          .createSignedUrl(record.storage_path, 3600)
        if (urlData) {
          setUrl(urlData.signedUrl)
          setStatus('completed')
        }
      } else if (record?.status === 'failed') {
        setStatus('error')
        setError('Frame generation failed')
      }
    } catch {
      // keep polling
    }
  }, [accessToken, recordId])

  useEffect(() => {
    if (status !== 'generating' || !recordId || !shouldPoll) return
    const interval = setInterval(checkFrame, pollInterval)
    return () => clearInterval(interval)
  }, [status, recordId, checkFrame, shouldPoll, pollInterval])

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
