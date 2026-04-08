import { useMemo } from 'react'
import { useRegisterADContext } from '@/features/ad/context/ad-context'

interface HistoryADContextInput {
  search: string
  total: number
  viewMode: string
}

export function useHistoryADContext(state: HistoryADContextInput) {
  const summary = useMemo(() => {
    const parts: Array<string> = []
    parts.push('Current History state:')
    parts.push(
      `- Viewing ${state.total} completed generations (${state.viewMode} view)`,
    )
    if (state.search) {
      parts.push(`- Searching for: "${state.search}"`)
    }
    return parts.join('\n')
  }, [state.search, state.total, state.viewMode])

  useRegisterADContext('history', summary)
}
