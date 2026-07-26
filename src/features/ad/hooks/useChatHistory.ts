'use client'

import { useCallback, useRef, useState } from 'react'
import type { ADMessage } from './useADChat'

const STORAGE_KEY = 'ad-chat-history'
const MAX_MESSAGES = 50
const DEBOUNCE_MS = 500

/**
 * Reshape messages for localStorage. Images are now URL refs (library rows),
 * which are small and resolve long-term from R2 — we persist them as-is so
 * attached image thumbnails survive panel close/reopen and page refresh.
 */
function stripImagesForStorage(messages: Array<ADMessage>): Array<ADMessage> {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    images: m.images,
    toolCalls: m.toolCalls,
    skillsLoaded: m.skillsLoaded,
  }))
}

function loadMessages(): Array<ADMessage> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_MESSAGES).map((m: ADMessage) => ({
      ...m,
      // Ensure message has an id (for backward compatibility)
      id:
        m.id ||
        `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      // Drop any pre-URL-era images that lack the new shape
      images: m.images?.every((img) => typeof img.url === 'string')
        ? m.images
        : undefined,
    }))
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
