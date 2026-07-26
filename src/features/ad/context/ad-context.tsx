'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import { buildSkillsIndex } from '../skills/registry'

export interface ADContextImage {
  /** Raw base64 data (no data: prefix) */
  base64: string
  /** MIME type e.g. image/png, image/jpeg */
  mediaType: string
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
  /** Context images registered by features (auto-injected into AD messages) */
  contextImages: Map<string, ADContextImage>
  /** Register a context image (call from feature routes) */
  registerImage: (key: string, image: ADContextImage) => void
  /** Unregister a context image (on unmount) */
  unregisterImage: (key: string) => void
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

## Craft: building the prompt

Word order is priority order. Lead with the main subject, then key action or pose, then the style and look, then context and environment, then secondary detail. What comes first gets the most weight.

Structure: Subject → Action → Style → Lighting → Context. Keep most prompts in the 30–80 word range for controlled output. Under 30 for fast exploration, 80+ only for complex multi-element scenes.

Lighting is the highest-impact element. "Golden hour backlight, soft lens flare" changes everything about a scene. Be specific: "hard side-light from a single practical bulb, deep shadows" vs "well-lit." Describe quality, direction, and source.

Describe what's present, never what's absent. "Sharp focus throughout" not "no blur." "Soft even lighting" not "no harsh shadows." Most models ignore negative framing.

Anchor era and texture with hardware and stock: "shot on Kodak Portra 400, natural grain" not "film look." "Sony A7IV, 85mm f/1.4, shallow depth of field" not "professional photo." "Fujifilm Superia 400, slight overexposure, muted saturation" reads better than "vintage." Lenses shape the look: 85mm flatters portraits, 35mm feels street-level and documentary, 24mm goes cinematic and spatial.

For color: tie hex codes to specific objects when precision matters. "The jacket in #2C3E50, the background wall in #F5F0E8" beats "dark jacket, light background." For text: put copy in quotes, specify placement, describe letterform style. "'OPEN' stenciled in white, top-left corner, military sans-serif."

For multi-shot or character sequences: exact descriptions must repeat verbatim across every prompt. Same hair color, same clothing, same distinguishing features -- word for word. Any variation breaks the continuity.

If the user mentions intended use -- PPT deck, social post, print, billboard -- that's a signal. It tells you aspect ratio, how much negative space the composition needs, and how much detail will actually survive at delivery size.

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
  '/dashboard/ai-images':
    'The user is on the AI Images page -- multi-model image generation with prompt input, model selection, brainstorm, edit, and variation workflows.',
}

const SKILLS_INDEX = buildSkillsIndex()

function buildSystemPrompt(
  route: string,
  featureContexts: Map<string, string>,
): string {
  const parts = [BASE_SYSTEM_PROMPT.trim()]

  if (SKILLS_INDEX) {
    parts.push(SKILLS_INDEX)
  }

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

  return parts.join('\n\n')
}

export function ADContextProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const route = pathname
  const [featureContexts, setFeatureContexts] = useState<Map<string, string>>(
    () => new Map(),
  )
  const [contextImages, setContextImages] = useState<
    Map<string, ADContextImage>
  >(() => new Map())
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

  const registerImage = useCallback((key: string, image: ADContextImage) => {
    setContextImages((prev) => {
      if (
        prev.get(key)?.base64 === image.base64 &&
        prev.get(key)?.mediaType === image.mediaType
      )
        return prev
      const next = new Map(prev)
      next.set(key, image)
      return next
    })
  }, [])

  const unregisterImage = useCallback((key: string) => {
    setContextImages((prev) => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  const systemPrompt = useMemo(
    () => buildSystemPrompt(route, featureContexts),
    [route, featureContexts],
  )

  const value = useMemo(
    () => ({
      route,
      featureContexts,
      register,
      unregister,
      systemPrompt,
      contextImages,
      registerImage,
      unregisterImage,
    }),
    [
      route,
      featureContexts,
      register,
      unregister,
      systemPrompt,
      contextImages,
      registerImage,
      unregisterImage,
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

/**
 * Register a context image from a route component.
 * AD will auto-inject this image as a vision block when the user sends a message.
 * Automatically unregisters on unmount.
 */
export function useRegisterADImage(key: string, image: ADContextImage | null) {
  const ctx = useContext(ADContext)
  const registerRef = useRef(ctx?.registerImage)
  const unregisterRef = useRef(ctx?.unregisterImage)
  registerRef.current = ctx?.registerImage
  unregisterRef.current = ctx?.unregisterImage

  useEffect(() => {
    if (image) {
      registerRef.current?.(key, image)
    } else {
      unregisterRef.current?.(key)
    }
  }, [key, image?.base64, image?.mediaType])

  useEffect(() => {
    return () => unregisterRef.current?.(key)
  }, [key])
}
