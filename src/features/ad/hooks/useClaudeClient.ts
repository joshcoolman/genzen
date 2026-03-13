import { useMemo } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { useAnthropicKey } from './useAnthropicKey'

export function useClaudeClient() {
  const { apiKey } = useAnthropicKey()

  const client = useMemo(() => {
    if (!apiKey) return null
    return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }, [apiKey])

  return client
}
