import { useCallback, useRef, useState } from 'react'
import { useADContext } from '../context/ad-context'
import { useClaudeClient } from './useClaudeClient'
import { useChatHistory } from './useChatHistory'

export interface ADMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useADChat() {
  const client = useClaudeClient()
  const { messages, setMessages, clearHistory } = useChatHistory()
  const { systemPrompt } = useADContext()
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const rafRef = useRef<number | null>(null)

  const sendMessage = useCallback(
    async (text: string) => {
      if (!client || !text.trim() || isStreaming) return

      const userMsg: ADMessage = { role: 'user', content: text.trim() }
      const next = [...messages, userMsg]
      setMessages(next)

      setIsStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      let accumulated = ''
      const assistantMsg: ADMessage = { role: 'assistant', content: '' }

      // Add placeholder assistant message
      setMessages([...next, assistantMsg])

      try {
        const stream = client.messages.stream(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            messages: next.map((m) => ({ role: m.role, content: m.content })),
          },
          { signal: controller.signal },
        )

        stream.on('text', (delta) => {
          accumulated += delta
          // rAF-throttled state updates
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null
              setMessages((prev: Array<ADMessage>) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                }
                return updated
              })
            })
          }
        })

        await stream.finalMessage()

        // Final flush
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        setMessages((prev: Array<ADMessage>) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: accumulated,
          }
          return updated
        })
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User aborted -- keep partial response
        } else {
          // Remove empty assistant placeholder on error
          setMessages((prev: Array<ADMessage>) => {
            const last = prev[prev.length - 1] as ADMessage | undefined
            if (last && last.role === 'assistant' && !last.content) {
              return prev.slice(0, -1)
            }
            return prev
          })
          console.error('AD chat error:', err)
        }
      } finally {
        abortRef.current = null
        setIsStreaming(false)
      }
    },
    [client, messages, isStreaming, setMessages, systemPrompt],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, sendMessage, isStreaming, abort, clearHistory }
}
