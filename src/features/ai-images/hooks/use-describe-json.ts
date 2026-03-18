import { useCallback, useState } from 'react'
import { describeImageJson } from '@/features/ai-images/server/describe-image-json.server'

interface UseDescribeJsonOptions {
  accessToken: string | undefined
  imageUrl: string | undefined
  onResult?: (json: string) => void
}

export function useDescribeJson({
  accessToken,
  imageUrl,
  onResult,
}: UseDescribeJsonOptions) {
  const [jsonDescription, setJsonDescription] = useState<string | null>(null)
  const [jsonLoading, setJsonLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDescribe = useCallback(async () => {
    if (!accessToken || !imageUrl || jsonLoading) return
    setJsonLoading(true)
    setError(null)
    try {
      const { json } = await describeImageJson({
        data: {
          accessToken,
          imageUrl,
          prompt:
            'Analyze this image for a reference DNA sheet. Focus on fixed architectural elements and furniture details.',
        },
      })
      setJsonDescription(json)
      onResult?.(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to describe image')
    } finally {
      setJsonLoading(false)
    }
  }, [accessToken, imageUrl, jsonLoading, onResult])

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
