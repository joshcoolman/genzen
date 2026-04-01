import { useCallback, useRef, useState } from 'react'
import { useADContext } from '../context/ad-context'
import { useClaudeClient } from './useClaudeClient'
import { useChatHistory } from './useChatHistory'
import type Anthropic from '@anthropic-ai/sdk'

export interface ADImage {
  /** Raw base64 data (no data: prefix) */
  base64: string
  /** MIME type e.g. image/png, image/jpeg */
  mediaType: string
}

export interface PromptCardTool {
  prompt: string
  title?: string
  tags?: Array<string>
}

export interface ADMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: Array<ADImage>
  toolCalls?: Array<{
    id: string
    name: string
    input: PromptCardTool
  }>
}

function buildMessageContent(
  text: string,
  images?: Array<ADImage>,
): string | Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> {
  if (!images || images.length === 0) return text
  return [
    ...images.map(
      (img): Anthropic.ImageBlockParam => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType as
            | 'image/jpeg'
            | 'image/png'
            | 'image/gif'
            | 'image/webp',
          data: img.base64,
        },
      }),
    ),
    { type: 'text' as const, text },
  ]
}

const PROMPT_CARD_TOOL: Anthropic.Tool = {
  name: 'create_prompt_card',
  description:
    'Display an image generation prompt with copy and save buttons. Use when writing, improving, or analyzing prompts for image generation.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description:
          'The detailed image generation prompt (10-2000 characters)',
      },
      title: {
        type: 'string',
        description: 'A short title for the prompt (optional, max 100 chars)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Category/style keywords (optional, max 8 tags, each max 30 chars)',
      },
    },
    required: ['prompt'],
  },
}

export function useADChat() {
  const client = useClaudeClient()
  const { messages, setMessages, clearHistory } = useChatHistory()
  const { systemPrompt } = useADContext()
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const rafRef = useRef<number | null>(null)

  const sendMessage = useCallback(
    async (text: string, images?: Array<ADImage>) => {
      if (!client || !text.trim() || isStreaming) return

      const userMsg: ADMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'user',
        content: text.trim(),
        images: images && images.length > 0 ? images : undefined,
      }
      const next = [...messages, userMsg]
      setMessages(next)

      setIsStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      let accumulated = ''
      const assistantMsg: ADMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'assistant',
        content: '',
      }

      // Add placeholder assistant message
      setMessages([...next, assistantMsg])

      try {
        const stream = client.messages.stream(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            tools: [PROMPT_CARD_TOOL],
            messages: next.map((m) => ({
              role: m.role,
              content: buildMessageContent(m.content, m.images),
            })),
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
                  ...updated[updated.length - 1],
                  content: accumulated,
                }
                return updated
              })
            })
          }
        })

        const finalMsg = await stream.finalMessage()

        // Final flush
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }

        // Extract tool calls from final message
        const toolCalls = finalMsg.content
          .filter((block) => block.type === 'tool_use')
          .map((block) => ({
            id: block.id,
            name: block.name,
            input: block.input as PromptCardTool,
          }))

        setMessages((prev: Array<ADMessage>) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: accumulated,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
