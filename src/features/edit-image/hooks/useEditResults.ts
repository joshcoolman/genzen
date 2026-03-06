import { useCallback } from 'react'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { getModelName } from '@/features/ai-images/models'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { CREDIT_COSTS } from '@/features/credits'
import { isCreditError } from '@/features/credits/handle-credit-error'

interface SubmitParams {
  accessToken: string
  sourceImageId: string
  editPrompt: string
  aspectRatio: string
  referenceImageIds: Array<string>
  modelIds: Array<string>
  generationsPerModel: number
}

interface UseEditResultsOptions {
  userId: string | undefined
  accessToken: string
}

export function useEditResults({ userId, accessToken }: UseEditResultsOptions) {
  const credits = useCredits()
  const {
    results,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    addPendingResult,
    replaceTempId,
    deleteResult,
  } = useGenerationResults({
    userId,
    accessToken,
    generationType: 'edit',
  })

  const submit = useCallback(
    async (params: SubmitParams) => {
      if (!params.editPrompt.trim()) {
        setError('Enter a prompt before generating.')
        return
      }
      if (!params.sourceImageId) {
        setError('Select a source image first.')
        return
      }

      const cost =
        CREDIT_COSTS.edit * params.modelIds.length * params.generationsPerModel
      if (credits.balance !== null && credits.balance < cost) {
        credits.showInsufficientCredits(cost)
        return
      }

      setError(null)
      setIsSubmitting(true)

      const pairs: Array<{ modelId: string; gen: number }> = []
      for (const modelId of params.modelIds) {
        for (let g = 0; g < params.generationsPerModel; g++) {
          pairs.push({ modelId, gen: g })
        }
      }

      const tempIds = pairs.map((_, i) => `temp-${Date.now()}-${i}`)
      for (let i = 0; i < pairs.length; i++) {
        addPendingResult({
          id: tempIds[i],
          status: 'pending',
          label: getModelName(pairs[i].modelId),
          prompt: params.editPrompt,
        })
      }

      try {
        const submissions = await Promise.allSettled(
          pairs.map((p) =>
            editImage({
              data: {
                accessToken: params.accessToken,
                sourceImageId: params.sourceImageId,
                editPrompt: params.editPrompt,
                aspectRatio: params.aspectRatio,
                editModelId: p.modelId,
                referenceImageIds: params.referenceImageIds,
                numImages: 1,
              },
            }),
          ),
        )

        for (let i = 0; i < tempIds.length; i++) {
          const submission = submissions[i]
          if (submission.status === 'fulfilled') {
            replaceTempId(tempIds[i], submission.value.recordId)
          }
        }
      } catch (err) {
        if (isCreditError(err)) {
          credits.showInsufficientCredits(cost)
        } else {
          setError(err instanceof Error ? err.message : 'Submission failed')
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [setError, setIsSubmitting, addPendingResult, replaceTempId],
  )

  return { results, isSubmitting, error, submit, deleteResult }
}
