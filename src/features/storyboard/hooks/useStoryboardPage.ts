import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateStyleFrame as generateStyleFrameServer } from '../server/generate-style-frame.server'
import { generateStoryFrame as generateStoryFrameServer } from '../server/generate-story-frame.server'
import type { GenerationResult } from '@/lib/types/generation-result'
import { MOCK_GRADIENTS } from '@/lib/constants/mock-gradients'
import { useAuth } from '@/lib/auth'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { supabase } from '@/lib/supabase'

const LS_SLOTS_KEY = 'storyboard_slot_ids'
const LS_STORY_KEY = 'storyboard_story'

function loadSlotIds(): Array<string | null> {
  try {
    const raw = localStorage.getItem(LS_SLOTS_KEY)
    if (!raw) return [null, null, null, null]
    const parsed = JSON.parse(raw) as Array<string | null>
    if (Array.isArray(parsed) && parsed.length === 4) return parsed
  } catch {}
  return [null, null, null, null]
}

function saveSlotIds(slots: Array<StyleFrameSlot | null>) {
  const ids = slots.map((s) => s?.imageId ?? null)
  localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(ids))
}

function loadStory(): string | null {
  try {
    return localStorage.getItem(LS_STORY_KEY)
  } catch {
    return null
  }
}

export type StoryboardTab = 'story' | 'elements' | 'scenes'
export type ReferenceCategory = 'character' | 'object' | 'environment'

export interface Reference {
  id: string
  category: ReferenceCategory
  label: string
  editInstruction: string
  status: 'idle' | 'generating'
}

export interface Scene {
  id: string
  prompt: string
  imageUrl: string | null
  status: 'idle' | 'generating' | 'done'
  gradient: string
}

export interface StyleFrameSlot {
  imageId: string
  url: string
}

const MAX_STYLE_FRAME_SLOTS = 4

export const STYLE_FRAME_MODELS = [
  { id: 'fal-ai/flux/schnell', name: 'FLUX Schnell' },
  { id: 'fal-ai/flux/dev', name: 'FLUX Dev' },
]

export const STORY_FRAME_MODELS = [
  { id: 'fal-ai/nano-banana-2/edit', name: 'Nano Banana 2' },
  { id: 'fal-ai/nano-banana-pro/edit', name: 'Nano Banana Pro' },
  { id: 'fal-ai/bytedance/seedream/v4/edit', name: 'Seedream v4' },
  { id: 'fal-ai/bytedance/seedream/v4.5/edit', name: 'Seedream v4.5' },
]

const SAMPLE_STORY = `A young girl discovers a hidden door in her grandmother's garden shed. Behind it lies a miniature world where insects have built a civilization of tiny bridges and towers made from leaves and twigs. She befriends a beetle architect who shows her the grand cathedral they've been building for generations. But a storm is coming, and she must help them reinforce their structures before everything is washed away.`

const MOCK_REFINED_STORY = `A curious young girl stumbles upon a concealed doorway tucked behind rusted tools in her grandmother's weathered garden shed. Beyond it, she discovers an extraordinary miniature civilization — a world where insects have engineered an intricate network of bridges spanning between mushroom caps and towers woven from living grass blades.

Her unlikely guide is a beetle architect, distinguished by a tiny hard hat and rolled-up leaf blueprints, who proudly leads her through bustling streets to their crowning achievement: a grand cathedral of layered bark and spider silk, its walls glowing with stained light filtered through preserved butterfly wings.

But dark clouds gather overhead. With a devastating storm bearing down, the girl must rally the insect workers — hauling tiny buckets of resin, placing twig buttresses, securing silk reinforcements — in a desperate race to save generations of painstaking work before the first enormous raindrops fall.`

const MOCK_STYLE_TAGS = [
  'cinematic',
  'warm golden light',
  'watercolor illustration',
  'macro photography feel',
  'whimsical',
  'muted earth tones',
]

const MOCK_REFERENCES: Array<Omit<Reference, 'editInstruction' | 'status'>> = [
  { id: 'ref-1', category: 'character', label: 'The young girl' },
  { id: 'ref-2', category: 'character', label: 'The beetle architect' },
  {
    id: 'ref-3',
    category: 'object',
    label: 'Grand cathedral of bark and silk',
  },
  { id: 'ref-4', category: 'object', label: 'Brass doorknob' },
  { id: 'ref-5', category: 'object', label: 'Leaf blueprints' },
  { id: 'ref-6', category: 'environment', label: "Grandmother's garden shed" },
  {
    id: 'ref-7',
    category: 'environment',
    label: 'Miniature insect civilization',
  },
  { id: 'ref-8', category: 'environment', label: 'Cathedral interior' },
]

const MOCK_SCENE_PROMPTS = [
  'Wide shot: A weathered garden shed surrounded by overgrown flowers, golden afternoon light filtering through the trees.',
  'Medium shot: The girl kneeling in the shed, brushing dust off an ornate wooden door half-hidden behind old garden tools.',
  'Close-up: Her hand turning the rusty brass doorknob, light spilling through the crack.',
  'Extreme wide shot: The miniature insect civilization revealed — tiny bridges spanning between mushrooms, towers of woven grass.',
  'Medium shot: The girl shrunk down to insect scale, standing at the entrance gate made of thorns and flower petals.',
  'Close-up: A beetle wearing a tiny hard hat, unrolling blueprints made from a dried leaf.',
  'Wide shot: The beetle architect leading her through bustling insect streets, ant workers carrying materials overhead.',
  'Low angle: The grand cathedral — an impossibly intricate structure of layered bark, held together with spider silk.',
  'Medium close-up: The girl and beetle inside the cathedral, stained-glass wings of dead butterflies casting colored light.',
  'Wide shot: Dark clouds rolling in over the garden, the miniature world below unaware.',
  'Medium shot: The girl rallying insects with tiny buckets of resin, reinforcing cathedral walls.',
  'Close-up: Her fingers carefully placing a twig buttress against the cathedral wall while beetles secure it with silk.',
  'Wide shot: Rain beginning to fall — enormous drops crashing like bombs around the structures, workers scrambling.',
  'Final wide shot: Morning after — the cathedral stands, battered but intact, the girl back to normal size, smiling at the shed door.',
]

function createScenes(): Array<Scene> {
  return MOCK_SCENE_PROMPTS.map((prompt, i) => ({
    id: `scene-${i + 1}`,
    prompt,
    imageUrl: null,
    status: 'idle' as const,
    gradient: MOCK_GRADIENTS[i % MOCK_GRADIENTS.length],
  }))
}

function createReferences(): Array<Reference> {
  return MOCK_REFERENCES.map((ref) => ({
    ...ref,
    editInstruction: '',
    status: 'idle' as const,
  }))
}

export interface UseStoryboardPageReturn {
  tab: StoryboardTab
  story: string
  scenes: Array<Scene>
  references: Array<Reference>
  styleTags: Array<string>
  // Style frame slots (4 fixed)
  styleFrameSlots: Array<StyleFrameSlot | null>
  styleFrameModelId: string
  setStyleFrameModelId: (id: string) => void
  isGeneratingStyle: boolean
  // Story frame
  storyFrameResults: Array<GenerationResult>
  selectedStoryFrameId: string | null
  storyFrameUrl: string | undefined
  hasStoryFrame: boolean
  isGeneratingStoryFrame: boolean
  storyFrameModelId: string
  setStoryFrameModelId: (id: string) => void
  // General
  isGenerating: boolean
  isRefining: boolean
  canProceedToScenes: boolean
  hasElements: boolean
  hasScenes: boolean
  filledSlotCount: number
  // Actions
  setTab: (tab: StoryboardTab) => void
  setStory: (story: string) => void
  refineStory: () => void
  generateStyleFrame: () => void
  clearStyleFrameSlot: (index: number) => void
  setStyleFrameSlot: (index: number, imageId: string, url: string) => void
  generateStoryFrame: () => void
  selectStoryFrame: (id: string) => void
  deleteStoryFrame: (id: string) => void
  generateReferences: () => void
  removeReference: (id: string) => void
  editReference: (id: string, instruction: string) => void
  generateScenes: () => void
  updateScenePrompt: (id: string, prompt: string) => void
  regenerateFrame: (id: string) => void
  generateAllFrames: () => void
  reset: () => void
}

export function useStoryboardPage(): UseStoryboardPageReturn {
  const { session } = useAuth()
  const userId = session?.user?.id
  const accessToken = session?.access_token ?? ''

  // Style frame generation tracking (for pending status)
  const styleFrameGen = useGenerationResults({
    userId,
    accessToken,
    generationType: 'style_frame',
    limit: 20,
  })

  // Story frame generation
  const storyFrameGen = useGenerationResults({
    userId,
    accessToken,
    generationType: 'story_frame',
    limit: 20,
  })

  const [tab, setTab] = useState<StoryboardTab>('story')
  const [story, setStoryState] = useState(() => loadStory() ?? SAMPLE_STORY)
  const [scenes, setScenes] = useState<Array<Scene>>([])
  const [references, setReferences] = useState<Array<Reference>>([])
  const [styleTags, setStyleTags] = useState<Array<string>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRefining, setIsRefining] = useState(false)

  // Persist story to localStorage
  const setStory = useCallback((text: string) => {
    setStoryState(text)
    try {
      localStorage.setItem(LS_STORY_KEY, text)
    } catch {}
  }, [])

  // Model selections
  const [styleFrameModelId, setStyleFrameModelId] = useState(
    STYLE_FRAME_MODELS[0].id,
  )
  const [storyFrameModelId, setStoryFrameModelId] = useState(
    STORY_FRAME_MODELS[0].id,
  )

  // 4 fixed style frame slots
  const [styleFrameSlots, setStyleFrameSlots] = useState<
    Array<StyleFrameSlot | null>
  >([null, null, null, null])

  // Track which generation IDs we've already auto-slotted
  const slottedIdsRef = useRef<Set<string>>(new Set())
  const restoredRef = useRef(false)

  // Restore slots from localStorage on mount
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const savedIds = loadSlotIds()
    const idsToResolve = savedIds.filter((id): id is string => id !== null)
    if (idsToResolve.length === 0) return

    // Mark these as already slotted so auto-slot doesn't overwrite them
    for (const id of idsToResolve) {
      slottedIdsRef.current.add(id)
    }

    // Fetch storage paths and signed URLs for saved slot IDs
    async function restoreSlots() {
      const { data: images } = await supabase
        .from('user_images')
        .select('id, storage_path')
        .in('id', idsToResolve)
        .is('deleted_at', null)

      if (!images?.length) return

      const urlMap: Record<string, string> = {}
      await Promise.all(
        images
          .filter((img) => img.storage_path)
          .map(async (img) => {
            const { data: signed } = await supabase.storage
              .from('user-images')
              .createSignedUrl(img.storage_path!, 3600)
            if (signed) urlMap[img.id] = signed.signedUrl
          }),
      )

      setStyleFrameSlots(
        savedIds.map((id) => {
          if (!id || !urlMap[id]) return null
          return { imageId: id, url: urlMap[id] }
        }),
      )
    }

    void restoreSlots()
  }, [])

  // Persist slots to localStorage whenever they change
  useEffect(() => {
    saveSlotIds(styleFrameSlots)
  }, [styleFrameSlots])

  // Story frame selection
  const [selectedStoryFrameId, setSelectedStoryFrameId] = useState<
    string | null
  >(null)

  // Auto-slot newly completed style frame generations
  useEffect(() => {
    for (const result of styleFrameGen.results) {
      if (
        result.status === 'complete' &&
        result.url &&
        !slottedIdsRef.current.has(result.id)
      ) {
        slottedIdsRef.current.add(result.id)
        setStyleFrameSlots((prev) => {
          const newSlot: StyleFrameSlot = {
            imageId: result.id,
            url: result.url!,
          }
          // Unshift into first position, shift others down, cap at 4
          const next = [newSlot, ...prev].slice(0, MAX_STYLE_FRAME_SLOTS)
          return next
        })
        // Only auto-slot the most recent one
        break
      }
    }
  }, [styleFrameGen.results])

  // Story frame derived state
  const firstCompleteStoryId = storyFrameGen.results.find(
    (r) => r.status === 'complete' && r.url,
  )?.id
  const effectiveSelectedStoryId =
    selectedStoryFrameId ?? firstCompleteStoryId ?? null
  const selectedStoryResult = storyFrameGen.results.find(
    (r) => r.id === effectiveSelectedStoryId,
  )
  const storyFrameUrl = selectedStoryResult?.url
  const hasStoryFrame = storyFrameGen.results.length > 0
  const isGeneratingStoryFrame =
    storyFrameGen.isSubmitting ||
    storyFrameGen.results.some((r) => r.status === 'pending')
  const isGeneratingStyle =
    styleFrameGen.isSubmitting ||
    styleFrameGen.results.some((r) => r.status === 'pending')

  const filledSlotCount = styleFrameSlots.filter(Boolean).length

  // Auto-select newly completed story frame
  useEffect(() => {
    const latest = storyFrameGen.results[0]
    if (latest?.status === 'complete' && latest.url) {
      setSelectedStoryFrameId(latest.id)
    }
  }, [storyFrameGen.results])

  const hasElements = references.length > 0
  const hasScenes = scenes.length > 0

  const canProceedToScenes = useMemo(() => {
    const categories: Array<ReferenceCategory> = [
      'character',
      'object',
      'environment',
    ]
    return categories.every((cat) => references.some((r) => r.category === cat))
  }, [references])

  const refineStory = useCallback(() => {
    setIsRefining(true)
    setTimeout(() => {
      setStory(MOCK_REFINED_STORY)
      setIsRefining(false)
    }, 800)
  }, [setStory])

  const clearStyleFrameSlot = useCallback((index: number) => {
    setStyleFrameSlots((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
  }, [])

  const setStyleFrameSlot = useCallback(
    (index: number, imageId: string, url: string) => {
      setStyleFrameSlots((prev) => {
        const next = [...prev]
        next[index] = { imageId, url }
        return next
      })
    },
    [],
  )

  const generateStyleFrame = useCallback(async () => {
    if (!accessToken || !story.trim()) return

    styleFrameGen.setIsSubmitting(true)
    try {
      const result = await generateStyleFrameServer({
        data: { story, accessToken, modelId: styleFrameModelId },
      })

      styleFrameGen.addPendingResult({
        id: result.recordId,
        status: 'pending',
        label: 'Style Frame',
      })

      setStyleTags(MOCK_STYLE_TAGS)
    } catch (err) {
      console.error('Style frame generation failed:', err)
      styleFrameGen.setError(
        err instanceof Error ? err.message : 'Generation failed',
      )
    } finally {
      styleFrameGen.setIsSubmitting(false)
    }
  }, [accessToken, story, styleFrameModelId, styleFrameGen])

  const selectStoryFrame = useCallback((id: string) => {
    setSelectedStoryFrameId(id)
  }, [])

  const deleteStoryFrame = useCallback(
    (id: string) => {
      storyFrameGen.dismissResult(id)
      if (effectiveSelectedStoryId === id) {
        setSelectedStoryFrameId(null)
      }
    },
    [storyFrameGen, effectiveSelectedStoryId],
  )

  const generateStoryFrame = useCallback(async () => {
    if (!accessToken || !story.trim()) return
    const imageIds = styleFrameSlots
      .filter((s): s is StyleFrameSlot => s !== null)
      .map((s) => s.imageId)
    if (imageIds.length === 0) return

    storyFrameGen.setIsSubmitting(true)
    try {
      const result = await generateStoryFrameServer({
        data: {
          story,
          accessToken,
          imageIds,
          modelId: storyFrameModelId,
        },
      })

      storyFrameGen.addPendingResult({
        id: result.recordId,
        status: 'pending',
        label: 'Story Frame',
      })
    } catch (err) {
      console.error('Story frame generation failed:', err)
      storyFrameGen.setError(
        err instanceof Error ? err.message : 'Generation failed',
      )
    } finally {
      storyFrameGen.setIsSubmitting(false)
    }
  }, [accessToken, story, styleFrameSlots, storyFrameModelId, storyFrameGen])

  const generateReferences = useCallback(() => {
    setIsGenerating(true)
    setTimeout(() => {
      setReferences(createReferences())
      setTab('elements')
      setIsGenerating(false)
    }, 1200)
  }, [])

  const removeReference = useCallback((id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const editReference = useCallback((id: string, _instruction: string) => {
    setReferences((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: 'generating' as const } : r,
      ),
    )
    setTimeout(() => {
      setReferences((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                label: `${r.label} (edited)`,
                status: 'idle' as const,
                editInstruction: '',
              }
            : r,
        ),
      )
    }, 1000)
  }, [])

  const generateScenes = useCallback(() => {
    setIsGenerating(true)
    setTimeout(() => {
      setScenes(createScenes())
      setTab('scenes')
      setIsGenerating(false)
    }, 1200)
  }, [])

  const updateScenePrompt = useCallback((id: string, prompt: string) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, prompt } : s)))
  }, [])

  const regenerateFrame = useCallback((id: string) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'generating' } : s)),
    )
    setTimeout(() => {
      setScenes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'done' } : s)),
      )
    }, 1500)
  }, [])

  const generateAllFrames = useCallback(() => {
    setScenes((prev) => prev.map((s) => ({ ...s, status: 'generating' })))
    setIsGenerating(true)
    setTimeout(() => {
      setScenes((prev) => prev.map((s) => ({ ...s, status: 'done' })))
      setIsGenerating(false)
    }, 2000)
  }, [])

  const reset = useCallback(() => {
    setTab('story')
    setScenes([])
    setReferences([])
    setStyleTags([])
    setIsGenerating(false)
    setIsRefining(false)
  }, [])

  return useMemo(
    () => ({
      tab,
      story,
      scenes,
      references,
      styleTags,
      styleFrameSlots,
      styleFrameModelId,
      setStyleFrameModelId,
      isGeneratingStyle,
      storyFrameResults: storyFrameGen.results,
      selectedStoryFrameId: effectiveSelectedStoryId,
      storyFrameUrl,
      hasStoryFrame,
      isGeneratingStoryFrame,
      storyFrameModelId,
      setStoryFrameModelId,
      isGenerating,
      isRefining,
      canProceedToScenes,
      hasElements,
      hasScenes,
      filledSlotCount,
      setTab,
      setStory,
      refineStory,
      generateStyleFrame,
      clearStyleFrameSlot,
      setStyleFrameSlot,
      generateStoryFrame,
      selectStoryFrame,
      deleteStoryFrame,
      generateReferences,
      removeReference,
      editReference,
      generateScenes,
      updateScenePrompt,
      regenerateFrame,
      generateAllFrames,
      reset,
    }),
    [
      tab,
      story,
      scenes,
      references,
      styleTags,
      styleFrameSlots,
      styleFrameModelId,
      isGeneratingStyle,
      storyFrameGen.results,
      effectiveSelectedStoryId,
      storyFrameUrl,
      hasStoryFrame,
      isGeneratingStoryFrame,
      storyFrameModelId,
      isGenerating,
      isRefining,
      canProceedToScenes,
      hasElements,
      hasScenes,
      filledSlotCount,
      refineStory,
      generateStyleFrame,
      clearStyleFrameSlot,
      setStyleFrameSlot,
      generateStoryFrame,
      selectStoryFrame,
      deleteStoryFrame,
      generateReferences,
      removeReference,
      editReference,
      generateScenes,
      updateScenePrompt,
      regenerateFrame,
      generateAllFrames,
      reset,
    ],
  )
}
