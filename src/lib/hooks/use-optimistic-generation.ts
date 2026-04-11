import { useCallback, useRef } from 'react'

/**
 * Generic optimistic-generation primitive. The caller owns the row id so the
 * client can push a pending card synchronously and the server persists under
 * the same id, eliminating the pause between click and card-visible and
 * allowing rapid-fire submissions without any correlation state.
 *
 * Shape: mint id -> onOptimistic(id, input) (sync) -> submit(id, input) (async)
 * -> onSuccess(id, result) or onError(id, err). Returns immediately so the
 * caller can fire again.
 */
export interface OptimisticHandle<TResult> {
  id: string
  promise: Promise<TResult>
}

export interface UseOptimisticGenerationOptions<TInput, TResult> {
  /** Called synchronously the moment the user submits. Push the pending card here. */
  onOptimistic: (id: string, input: TInput) => void
  /** Called once the server resolves successfully. */
  onSuccess?: (id: string, result: TResult) => void
  /** Called if the server throws. Flip the card to failed here. */
  onError: (id: string, error: Error) => void
  /** The actual server call. Receives the client-minted id so the server can use it as PK. */
  submit: (id: string, input: TInput) => Promise<TResult>
}

export function useOptimisticGeneration<TInput, TResult>(
  opts: UseOptimisticGenerationOptions<TInput, TResult>,
): (input: TInput) => OptimisticHandle<TResult> {
  const ref = useRef(opts)
  ref.current = opts

  return useCallback((input: TInput): OptimisticHandle<TResult> => {
    const id = crypto.randomUUID()
    ref.current.onOptimistic(id, input)

    const promise = ref.current.submit(id, input).then(
      (result) => {
        ref.current.onSuccess?.(id, result)
        return result
      },
      (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err))
        ref.current.onError(id, error)
        throw error
      },
    )

    return { id, promise }
  }, [])
}
