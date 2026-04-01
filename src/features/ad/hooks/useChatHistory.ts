import { useCallback, useRef, useState } from 'react'
import type { ADMessage } from './useADChat'

const STORAGE_KEY = 'ad-chat-history'
const MAX_MESSAGES = 50
const DEBOUNCE_MS = 500

/** Strip images and tool calls from messages before persisting to avoid blowing up localStorage */
function stripImagesForStorage(messages: Array<ADMessage>): Array<ADMessage> {
  return messages.map((m) => {
    const base = {
      id: m.id,
      role: m.role,
      content: m.content,
      // Store a flag that images were attached but not the data
      images: m.images?.map((img) => ({
        base64: '',
        mediaType: img.mediaType,
      })),
      // Strip tool calls to save space
    }
    return base as ADMessage
  })
}

function loadMessages(): Array<ADMessage> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Filter out empty-base64 image placeholders from storage
    return parsed.slice(-MAX_MESSAGES).map((m: ADMessage) => {
      // Ensure message has an id (for backward compatibility)
      const message = {
        ...m,
        id:
          m.id ||
          `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
      if (message.images?.every((img) => !img.base64)) {
        return { ...message, images: undefined }
      }
      return message
    })
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

        // Debounced localStorage write (without image data)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(stripImagesForStorage(capped)),
            )
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
