'use client'

import { useCallback, useState } from 'react'
import { describeImageJson } from '#/features/ai-images/server/describe-image-json.action'

interface UseDescribeJsonOptions {
  imageUrl: string | undefined
  onResult?: (json: string) => void
}

export function useDescribeJson({
  imageUrl,
  onResult,
}: UseDescribeJsonOptions) {
  const [jsonDescription, setJsonDescription] = useState<string | null>(null)
  const [jsonLoading, setJsonLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDescribe = useCallback(async () => {
    if (!imageUrl || jsonLoading) return
    setJsonLoading(true)
    setError(null)
    try {
      const { json } = await describeImageJson({
        imageUrl,
        prompt:
          'Analyze this image for a reference DNA sheet. Focus on fixed architectural elements and furniture details.',
      })
      setJsonDescription(json)
      onResult?.(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to describe image')
    } finally {
      setJsonLoading(false)
    }
  }, [imageUrl, jsonLoading, onResult])

  const clearDescription = useCallback(() => {
    setJsonDescription(null)
    setError(null)
  }, [])

  return {
    jsonDescription,
    jsonLoading,
    error,
    handleDescribe,
    clearDescription,
  }
}
