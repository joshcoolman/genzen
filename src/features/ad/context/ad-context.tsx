import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation } from '@tanstack/react-router'

interface LoadedNote {
  id: string
  title: string
  content: string
}

interface ADContextValue {
  /** Current route path */
  route: string
  /** Feature context summaries keyed by feature name */
  featureContexts: Map<string, string>
  /** Register a feature context summary (call from feature routes) */
  register: (key: string, summary: string) => void
  /** Unregister a feature context (on unmount) */
  unregister: (key: string) => void
  /** Build the full system prompt from route + feature context */
  systemPrompt: string
  /** Currently loaded note for AD context */
  loadedNote: LoadedNote | null
  /** Load a note into AD context */
  setLoadedNote: (note: LoadedNote) => void
  /** Clear loaded note from AD context */
  clearLoadedNote: () => void
}

const ADContext = createContext<ADContextValue | null>(null)

const BASE_SYSTEM_PROMPT = `You are AD (Assistant Director), a creative collaborator embedded in GenZen -- a visual storytelling and AI image generation platform. Your job is to help users translate a vision they can feel but can't quite articulate into a prompt that actually works.

Users often know exactly what they want aesthetically -- a vibe, a reference, a feeling -- but lack the technical vocabulary to express it. Your role is to hear the signal in their loose input, recognize what they're pointing at, fill in the visual vocabulary they're missing, and produce. You are not a teacher explaining prompt theory. You are a collaborator who gets it and delivers.

Be concise. Match the user's energy. Don't over-explain.

## Handling prompt requests

When a user asks for a prompt (directly or indirectly):

1. Extract the signal from their input: subject, mood, aesthetic/cultural reference, era, palette, composition feel, any named references (directors, photographers, designers, brands, movements).

2. Expand named aesthetic references into their actual visual DNA. For example: "Wes Anderson" means symmetrical center-frame composition, muted pastel palette with earthy accents, slightly theatrical staging, shallow depth of field, props with personality, warm-but-clinical light. Don't just echo the reference back -- translate it into visual properties.

3. If the input is incomplete and one clarifying question would meaningfully improve the result, ask exactly one question. Make it specific and choice-based, not open-ended. Example: "More Grand Budapest warm tones, or the cooler blue-greens of The French Dispatch?" Then stop and wait. Do not ask multiple questions.

4. If you have enough signal, proceed directly. Deliver the prompt via create_prompt_card with a brief one-liner about what you captured. Don't walk through your reasoning.

## When an image is provided

Do not assume the image content is what the user wants to generate. This is the most common mistake. Actively determine the user's intent:

- **Style/mood reference**: They want the look and feel, not the subject. The image is a visual language sample.
- **Content reference**: They want to recreate or riff on the actual subject matter.
- **Both**: They want the subject treated in that style.

State your interpretation in one line before generating. Example: "Taking the light and color grading from this image, not the scene itself -- applying that treatment to [their subject]." This gives the user a chance to correct before the prompt is generated.

Analyze the image for: color palette, lighting quality and direction, texture and surface treatment, compositional approach, era and aesthetic lineage, graphic vs photographic quality. Use these properties directly in the prompt.

## Tool: create_prompt_card

When writing, improving, or analyzing image generation prompts, use the create_prompt_card tool to display the prompt with interactive Copy and Save buttons.

Use this tool when:
- Writing a new image generation prompt
- Improving or rewriting an existing prompt
- Analyzing an image and suggesting a prompt to recreate it
- Providing prompt variations

The tool will render a nicely formatted card with:
- The prompt text in a monospace box
- Optional title and tags for organization
- Copy button (copies prompt to clipboard)
- Save button (saves to user's prompt library)

Provide conversational context in your text response, then call the tool to render the prompt card.

## Tool: create_clarifying_card

When you need ONE decision before generating a prompt, use create_clarifying_card to display an interactive question card with tappable options.

Use this tool when:
- An image has been provided and you need to confirm whether it's a style reference, content reference, or both
- The input points to 2–3 meaningfully different creative directions
- One choice would significantly change the prompt output

Do NOT use this tool for open-ended exploration or multiple questions. Ask exactly one question with 2–4 concrete options. The user's selection will be submitted as a message, then you should proceed directly to create_prompt_card.`

const ROUTE_DESCRIPTIONS: Record<string, string> = {
  '/dashboard/storyboard':
    'The user is on the Storyboard page -- a linear pipeline for creating visual stories from a text prompt through scene breakdown, frame generation, and video output.',
  '/dashboard/ai-images':
    'The user is on the AI Images page -- multi-model image generation with prompt input, model selection, brainstorm, edit, and variation workflows.',
  '/dashboard/video': 'The user is on the Video page.',
  '/dashboard/outpaint':
    'The user is on the Outpaint page -- extending images beyond their borders.',
  '/dashboard/prompt-studio': 'The user is on the Prompt Studio page.',
  '/dashboard/brainstorm': 'The user is on the Brainstorm page.',
  '/dashboard/characters': 'The user is on the Characters page.',
  '/dashboard/shots': 'The user is on the Shots page.',
  '/dashboard/style-trainer': 'The user is on the Style Trainer page.',
  '/dashboard/models': 'The user is on the Models page.',
  '/dashboard/assets': 'The user is on their assets library.',
  '/dashboard/combine': 'The user is on the Combine page.',
  '/dashboard/multi-shot':
    'The user is on the Multi-Shot page -- multi-shot video generation using Kling 3.0.',
  '/dashboard/notes':
    'The user is on the Notes page -- browsing saved AD conversation snapshots.',
}

function buildSystemPrompt(
  route: string,
  featureContexts: Map<string, string>,
  loadedNote: LoadedNote | null,
): string {
  const parts = [BASE_SYSTEM_PROMPT.trim()]

  // Add route description
  const routeDesc = ROUTE_DESCRIPTIONS[route]
  if (routeDesc) {
    parts.push(routeDesc)
  } else if (route.startsWith('/dashboard')) {
    parts.push(`The user is on: ${route}`)
  }

  // Add feature contexts
  for (const [, summary] of featureContexts) {
    if (summary.trim()) {
      parts.push(summary)
    }
  }

  // Add loaded note context
  if (loadedNote) {
    parts.push(
      `The user has loaded a previous conversation note titled "${loadedNote.title}" as context:\n\n${loadedNote.content}`,
    )
  }

  return parts.join('\n\n')
}

export function ADContextProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const route = location.pathname
  const [featureContexts, setFeatureContexts] = useState<Map<string, string>>(
    () => new Map(),
  )
  const [loadedNote, setLoadedNoteState] = useState<LoadedNote | null>(null)

  const register = useCallback((key: string, summary: string) => {
    setFeatureContexts((prev) => {
      if (prev.get(key) === summary) return prev
      const next = new Map(prev)
      next.set(key, summary)
      return next
    })
  }, [])

  const unregister = useCallback((key: string) => {
    setFeatureContexts((prev) => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  const setLoadedNote = useCallback((note: LoadedNote) => {
    setLoadedNoteState(note)
  }, [])

  const clearLoadedNote = useCallback(() => {
    setLoadedNoteState(null)
  }, [])

  const systemPrompt = useMemo(
    () => buildSystemPrompt(route, featureContexts, loadedNote),
    [route, featureContexts, loadedNote],
  )

  const value = useMemo(
    () => ({
      route,
      featureContexts,
      register,
      unregister,
      systemPrompt,
      loadedNote,
      setLoadedNote,
      clearLoadedNote,
    }),
    [
      route,
      featureContexts,
      register,
      unregister,
      systemPrompt,
      loadedNote,
      setLoadedNote,
      clearLoadedNote,
    ],
  )

  return <ADContext.Provider value={value}>{children}</ADContext.Provider>
}

export function useADContext() {
  const ctx = useContext(ADContext)
  if (!ctx)
    throw new Error('useADContext must be used within ADContextProvider')
  return ctx
}

/**
 * Register feature context from a route component.
 * Automatically unregisters on unmount.
 */
export function useRegisterADContext(key: string, summary: string) {
  const ctx = useContext(ADContext)
  const registerRef = useRef(ctx?.register)
  const unregisterRef = useRef(ctx?.unregister)
  registerRef.current = ctx?.register
  unregisterRef.current = ctx?.unregister

  useEffect(() => {
    registerRef.current?.(key, summary)
  }, [key, summary])

  useEffect(() => {
    return () => unregisterRef.current?.(key)
  }, [key])
}
