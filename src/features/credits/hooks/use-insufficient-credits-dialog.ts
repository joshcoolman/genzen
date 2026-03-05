import { useCallback, useRef, useState } from 'react'

interface DialogState {
  open: boolean
  cost: number
  balance: number
}

export function useInsufficientCreditsDialog() {
  const [state, setState] = useState<DialogState>({
    open: false,
    cost: 0,
    balance: 0,
  })
  const retryRef = useRef<(() => void) | null>(null)

  const showDialog = useCallback(
    (cost: number, balance: number, onRetry?: () => void) => {
      retryRef.current = onRetry ?? null
      setState({ open: true, cost, balance })
    },
    [],
  )

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      retryRef.current = null
      setState((s) => ({ ...s, open: false }))
    }
  }, [])

  const handleTopUp = useCallback(() => {
    retryRef.current = null
    setState((s) => ({ ...s, open: false }))
  }, [])

  return {
    dialogState: state,
    showDialog,
    handleOpenChange,
    handleTopUp,
  }
}
