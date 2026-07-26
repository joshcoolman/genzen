'use client'

import { useCallback, useRef, useState } from 'react'
import { useADContext } from '../context/ad-context'
import { getSkill } from '../skills/registry'
import { useClaudeClient } from './useClaudeClient'
import { useChatHistory } from './useChatHistory'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * User-attached image picked from the library via ImageSourceDialog.
 * Sent to Anthropic via URL image source — no base64 plumbing.
 */
export interface ADImage {
  /** Library row id (user_images.id) */
  id: string
  /** R2 public URL — sent to Anthropic and rendered in chat */
  url: string
  /** Optional display title from the library row */
  title?: string
}

/** Per-feature context image registered via useRegisterADImage — still base64. */
interface ADContextImageBase64 {
  base64: string
  mediaType: string
}

export interface PromptCardTool {
  prompt: string
  title?: string
  tags?: Array<string>
}

export interface ClarifyingCardTool {
  interpretation: string
  question: string
  options: Array<string>
}

export interface LoadedSkillRef {
  /** Tool-use id from the API call that loaded it */
  id: string
  name: string
  body: string
}

export interface ADMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: Array<ADImage>
  toolCalls?: Array<
    | { id: string; name: 'create_prompt_card'; input: PromptCardTool }
    | { id: string; name: 'create_clarifying_card'; input: ClarifyingCardTool }
  >
  /** Skills loaded by AD during this assistant turn, rendered as chips above content */
  skillsLoaded?: Array<LoadedSkillRef>
}

/**
 * Shape the outgoing message content for Anthropic. User-attached images are
 * URL-referenced (library rows); feature-registered context images stay
 * base64. Both flow through the same message as image blocks.
 */
function buildMessageContent(
  text: string,
  attached: Array<ADImage> | undefined,
  contextImages: Array<ADContextImageBase64>,
): string | Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> {
  const hasAttached = attached && attached.length > 0
  const hasContext = contextImages.length > 0
  if (!hasAttached && !hasContext) return text

  const blocks: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = []

  for (const img of contextImages) {
    blocks.push({
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
    })
  }

  if (hasAttached) {
    for (const img of attached) {
      blocks.push({
        type: 'image',
        source: { type: 'url', url: img.url },
      })
    }
  }

  blocks.push({ type: 'text' as const, text })
  return blocks
}

const LOAD_SKILL_TOOL: Anthropic.Tool = {
  name: 'load_skill',
  description:
    'Load the full body of a skill from the library. Call this before composing a prompt card when a skill description matches the user intent. The returned body contains detailed guidance you should apply to your answer. You may load multiple skills in parallel if more than one applies.',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Skill name exactly as listed in the Available Skills section of the system prompt',
      },
    },
    required: ['name'],
  },
}

const CLARIFYING_CARD_TOOL: Anthropic.Tool = {
  name: 'create_clarifying_card',
  description:
    'Ask the user one targeted clarifying question with 2–4 tappable option buttons before generating a prompt. Use when a single decision point would meaningfully improve the output — especially when an image has been provided.',
  input_schema: {
    type: 'object',
    properties: {
      interpretation: {
        type: 'string',
        description:
          "One-line statement of how you are interpreting the user's input or image (max 200 chars)",
      },
      question: {
        type: 'string',
        description: 'The single clarifying question (max 150 chars)',
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description:
          '2–4 short option labels the user can tap (each max 60 chars)',
      },
    },
    required: ['interpretation', 'question', 'options'],
  },
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
  const { systemPrompt, contextImages } = useADContext()
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const rafRef = useRef<number | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const sendMessage = useCallback(
    async (text: string, images?: Array<ADImage>) => {
      if (!text.trim() || isStreaming) return
      if (!client) {
        setError(
          "AD isn't configured. Re-enter your Anthropic API key from the panel header to continue.",
        )
        return
      }
      // Clear any prior error once the user successfully kicks off a new send
      setError(null)

      // Snapshot the context images for this turn. They are NOT stored on the
      // persisted ADMessage — they are attached to the API request at
      // build time so they only apply to the turn where they were active.
      const currentContextImages: Array<ADContextImageBase64> = []
      for (const [, ctxImg] of contextImages) {
        currentContextImages.push({
          base64: ctxImg.base64,
          mediaType: ctxImg.mediaType,
        })
      }

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

      // Messages shaped for the Anthropic API. Mutated across agentic iterations
      // when load_skill fires (we append assistant tool_use + user tool_result
      // and re-stream). Existing render-tools (create_prompt_card,
      // create_clarifying_card) stay terminal and break the loop.
      //
      // Context images only attach to the LAST user message (the current
      // turn) — historical turns keep whatever URL-attached images they
      // originally had, but no longer carry stale base64 context.
      const apiMessages: Array<Anthropic.MessageParam> = next.map((m, i) => ({
        role: m.role,
        content: buildMessageContent(
          m.content,
          m.images,
          i === next.length - 1 ? currentContextImages : [],
        ),
      }))

      const loadedSkills: Array<LoadedSkillRef> = []

      try {
        // Agentic loop: keeps re-streaming as long as the model calls load_skill.
        // When a turn has zero load_skill calls, we commit and break.
        // Hard cap to prevent runaway cycles from a misbehaving model.
        const MAX_ITERATIONS = 6
        let iteration = 0
        let committed = false

        while (iteration < MAX_ITERATIONS) {
          iteration++
          accumulated = ''

          const stream = client.messages.stream(
            {
              model: 'claude-sonnet-4-6',
              max_tokens: 4096,
              system: systemPrompt,
              tools: [LOAD_SKILL_TOOL, PROMPT_CARD_TOOL, CLARIFYING_CARD_TOOL],
              messages: apiMessages,
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
                    skillsLoaded:
                      loadedSkills.length > 0 ? [...loadedSkills] : undefined,
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

          const loadSkillUses = finalMsg.content.filter(
            (block): block is Anthropic.ToolUseBlock =>
              block.type === 'tool_use' && block.name === 'load_skill',
          )

          if (loadSkillUses.length === 0) {
            // Terminal turn — extract render-tool calls and commit
            const toolCalls = finalMsg.content
              .filter(
                (block): block is Anthropic.ToolUseBlock =>
                  block.type === 'tool_use',
              )
              .map((block) => {
                if (block.name === 'create_clarifying_card') {
                  return {
                    id: block.id,
                    name: 'create_clarifying_card' as const,
                    input: block.input as ClarifyingCardTool,
                  }
                }
                return {
                  id: block.id,
                  name: 'create_prompt_card' as const,
                  input: block.input as PromptCardTool,
                }
              })

            setMessages((prev: Array<ADMessage>) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: accumulated,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                skillsLoaded:
                  loadedSkills.length > 0 ? [...loadedSkills] : undefined,
              }
              return updated
            })
            committed = true
            break
          }

          // Agentic continuation: resolve skills, append tool_use + tool_result,
          // track for UI, and let the loop re-stream.
          apiMessages.push({ role: 'assistant', content: finalMsg.content })
          apiMessages.push({
            role: 'user',
            content: loadSkillUses.map((use) => {
              const skillName =
                typeof use.input === 'object' &&
                use.input !== null &&
                'name' in use.input &&
                typeof (use.input as { name: unknown }).name === 'string'
                  ? (use.input as { name: string }).name
                  : ''
              const skill = skillName ? getSkill(skillName) : undefined
              if (skill) {
                loadedSkills.push({
                  id: use.id,
                  name: skill.name,
                  body: skill.body,
                })
              }
              return {
                type: 'tool_result',
                tool_use_id: use.id,
                content: skill
                  ? skill.body
                  : `Skill "${skillName}" not found. Do not retry; compose your answer without it.`,
              }
            }),
          })
        }

        if (!committed) {
          // Hit iteration cap — commit whatever we have so the user isn't stranded
          setMessages((prev: Array<ADMessage>) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content:
                accumulated ||
                '(AD stopped after too many skill-loading iterations.)',
              skillsLoaded:
                loadedSkills.length > 0 ? [...loadedSkills] : undefined,
            }
            return updated
          })
        }
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
          const message = err instanceof Error ? err.message : 'Unknown error'
          setError(
            `AD hit an error: ${message}. Try sending again — if it keeps happening, log out and back in, or check your Anthropic API key.`,
          )
          console.error('AD chat error:', err)
        }
      } finally {
        abortRef.current = null
        setIsStreaming(false)
      }
    },
    [client, messages, isStreaming, setMessages, systemPrompt, contextImages],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    messages,
    sendMessage,
    isStreaming,
    abort,
    clearHistory,
    error,
    clearError,
  }
}
