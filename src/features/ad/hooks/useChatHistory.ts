import { useCallback, useRef, useState } from 'react'
import type { ADMessage } from './useADChat'

const STORAGE_KEY = 'ad-chat-history'
const MAX_MESSAGES = 50
const DEBOUNCE_MS = 500

function loadMessages(): Array<ADMessage> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

export function useChatHistory() {
  const [messages, setMessagesState] = useState<Array<ADMessage>>(loadMessages)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setMessages = useCallback(
    (
      next: Array<ADMessage> | ((prev: Array<ADMessage>) => Array<ADMessage>),
    ) => {
      setMessagesState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        const capped = resolved.slice(-MAX_MESSAGES)

        // Debounced localStorage write
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(capped))
          } catch {
            // Storage full -- silently fail
          }
        }, DEBOUNCE_MS)

        return capped
      })
    },
    [],
  )

  const clearHistory = useCallback(() => {
    setMessagesState([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { messages, setMessages, clearHistory }
}
