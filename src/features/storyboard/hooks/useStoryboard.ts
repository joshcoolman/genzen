import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refineStory as refineStoryServer } from '../server/refine-story.server'
import { generateScenes as generateScenesServer } from '../server/generate-scenes.server'
import { generateStoryboardFrame as generateFrameServer } from '../server/generate-storyboard-frame.server'
import { generateCharacterRef as generateCharacterRefServer } from '../server/generate-character-ref.server'
import { saveStoryboard as saveStoryboardServer } from '../server/save-storyboard.server'
import { loadStoryboard as loadStoryboardServer } from '../server/load-storyboard.server'
import type { Scene, StoryboardCharacter, StoryboardStatus } from '../types'
import { supabase } from '@/lib/supabase'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { useAuth } from '@/lib/auth'

const SAMPLE_STORY = `A superhero reflects on his childhood — discovering his abilities as a kid, the rush of early fame, his rise to a massive film career. But it all unravels. The final scene: alone in a sprawling mansion, surrounded by empty bottles and fading glory.`

export interface UseStoryboardReturn {
  // State
  storyboardId: string | null
  storyPrompt: string
  refinedStory: string | null
  scenes: Array<Scene>
  characters: Array<StoryboardCharacter>
  status: StoryboardStatus
  frameModelId: string
  // Loading states
  isRefining: boolean
  isGeneratingScenes: boolean
  isSaving: boolean
  isLoading: boolean
  error: string | null
  // Derived
  hasScenes: boolean
  generatingSceneIds: Set<string>
  generatingCharacterSlugs: Set<string>
  // Actions
  setStoryPrompt: (text: string) => void
  refineStory: () => void
  generateScenes: () => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  updateCharacter: (slug: string, updates: Partial<StoryboardCharacter>) => void
  generateCharacterRef: (slug: string, promptOverride?: string) => void
  addCharacterRefImage: (
    slug: string,
    image: { id: string; url: string | null },
  ) => void
  generateFrame: (sceneId: string) => void
  generateAllFrames: () => void
  setFrameModelId: (id: string) => void
  save: () => void
  reset: () => void
}

export function useStoryboard(): UseStoryboardReturn {
  const { session } = useAuth()
  const userId = session?.user.id
  const accessToken = session?.access_token ?? ''

  const [storyboardId, setStoryboardId] = useState<string | null>(null)
  const [storyPrompt, setStoryPrompt] = useState(SAMPLE_STORY)
  const [refinedStory, setRefinedStory] = useState<string | null>(null)
  const [scenes, setScenes] = useState<Array<Scene>>([])
  const [characters, setCharacters] = useState<Array<StoryboardCharacter>>([])
  const [status, setStatus] = useState<StoryboardStatus>('draft')
  const [frameModelId, setFrameModelId] = useState('fal-ai/flux/schnell')
  const [isRefining, setIsRefining] = useState(false)
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingSceneIds, setGeneratingSceneIds] = useState<Set<string>>(
    new Set(),
  )
  const [generatingCharacterSlugs, setGeneratingCharacterSlugs] = useState<
    Set<string>
  >(new Set())

  // Track frame generations via existing hook
  const frameGen = useGenerationResults({
    userId,
    accessToken,
    generationType: 'storyboard_frame',
    limit: 50,
  })

  // Track character ref generations
  const charRefGen = useGenerationResults({
    userId,
    accessToken,
    generationType: 'character_ref',
    limit: 50,
  })

  // Map completed frame results back to scenes
  const processedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const result of frameGen.results) {
      if (
        result.status === 'complete' &&
        !processedIdsRef.current.has(result.id)
      ) {
        processedIdsRef.current.add(result.id)

        supabase
          .from('user_images')
          .select('id, generation_metadata')
          .eq('id', result.id)
          .single()
          .then(({ data }) => {
            if (!data?.generation_metadata) return
            const meta = data.generation_metadata as Record<string, unknown>
            const sceneId = meta.scene_id as string | undefined
            if (!sceneId) return

            setScenes((prev) =>
              prev.map((s) =>
                s.id === sceneId
                  ? { ...s, image_id: result.id, image_url: result.url ?? null }
                  : s,
              ),
            )
            setGeneratingSceneIds((prev) => {
              const next = new Set(prev)
              next.delete(sceneId)
              return next
            })
          })
      }
    }
  }, [frameGen.results])

  // Map completed character ref results back to characters
  const processedCharRefIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const result of charRefGen.results) {
      if (
        result.status === 'complete' &&
        !processedCharRefIdsRef.current.has(result.id)
      ) {
        processedCharRefIdsRef.current.add(result.id)

        supabase
          .from('user_images')
          .select('id, generation_metadata')
          .eq('id', result.id)
          .single()
          .then(({ data }) => {
            if (!data?.generation_metadata) return
            const meta = data.generation_metadata as Record<string, unknown>
            const slug = meta.character_slug as string | undefined
            if (!slug) return

            setCharacters((prev) =>
              prev.map((c) =>
                c.slug === slug
                  ? {
                      ...c,
                      reference_images: [
                        ...c.reference_images,
                        { id: result.id, url: result.url ?? null },
                      ],
                    }
                  : c,
              ),
            )
            setGeneratingCharacterSlugs((prev) => {
              const next = new Set(prev)
              next.delete(slug)
              return next
            })
          })
      }
    }
  }, [charRefGen.results])

  // Load most recent storyboard on mount
  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)

    loadStoryboardServer({ data: { accessToken } })
      .then(({ storyboard }) => {
        if (storyboard) {
          setStoryboardId(storyboard.id)
          setStoryPrompt(storyboard.story_prompt)
          setRefinedStory(storyboard.refined_story)
          setScenes(
            Array.isArray(storyboard.scenes)
              ? storyboard.scenes
              : JSON.parse(storyboard.scenes as unknown as string),
          )
          const chars = storyboard.characters
          setCharacters(
            Array.isArray(chars)
              ? chars
              : typeof chars === 'string'
                ? JSON.parse(chars)
                : [],
          )
          setStatus(storyboard.status)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [accessToken])

  // Resolve image URLs for scenes that have image_ids but no image_urls
  useEffect(() => {
    const needUrls = scenes.filter((s) => s.image_id && !s.image_url)
    if (needUrls.length === 0) return

    const ids = needUrls.map((s) => s.image_id!)
    supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', ids)
      .eq('status', 'completed')
      .then(async ({ data: rows }) => {
        if (!rows?.length) return
        const urlMap: Record<string, string> = {}
        await Promise.all(
          rows
            .filter((r) => r.storage_path)
            .map(async (r) => {
              const { data: signed } = await supabase.storage
                .from('user-images')
                .createSignedUrl(r.storage_path, 3600)
              if (signed) urlMap[r.id] = signed.signedUrl
            }),
        )
        setScenes((prev) =>
          prev.map((s) =>
            s.image_id && urlMap[s.image_id]
              ? { ...s, image_url: urlMap[s.image_id] }
              : s,
          ),
        )
      })
  }, [scenes.map((s) => `${s.image_id}:${s.image_url}`).join(',')])

  // Resolve image URLs for character reference images
  useEffect(() => {
    const needUrls: Array<string> = []
    for (const c of characters) {
      for (const img of c.reference_images) {
        if (img.id && !img.url) needUrls.push(img.id)
      }
    }
    if (needUrls.length === 0) return

    supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', needUrls)
      .eq('status', 'completed')
      .then(async ({ data: rows }) => {
        if (!rows?.length) return
        const urlMap: Record<string, string> = {}
        await Promise.all(
          rows
            .filter((r) => r.storage_path)
            .map(async (r) => {
              const { data: signed } = await supabase.storage
                .from('user-images')
                .createSignedUrl(r.storage_path, 3600)
              if (signed) urlMap[r.id] = signed.signedUrl
            }),
        )
        setCharacters((prev) =>
          prev.map((c) => ({
            ...c,
            reference_images: c.reference_images.map((img) =>
              img.id && urlMap[img.id] ? { ...img, url: urlMap[img.id] } : img,
            ),
          })),
        )
      })
  }, [
    characters
      .flatMap((c) => c.reference_images.map((i) => `${i.id}:${i.url}`))
      .join(','),
  ])

  const refineStory = useCallback(async () => {
    if (!accessToken || !storyPrompt.trim()) return
    setIsRefining(true)
    try {
      const result = await refineStoryServer({
        data: { story: storyPrompt, accessToken },
      })
      setRefinedStory(result.story)
      setStoryPrompt(result.story)
    } catch (err) {
      console.error('Refine failed:', err)
    } finally {
      setIsRefining(false)
    }
  }, [accessToken, storyPrompt])

  const generateScenesAction = useCallback(async () => {
    if (!accessToken || !storyPrompt.trim()) return
    setIsGeneratingScenes(true)
    setError(null)
    try {
      const story = refinedStory ?? storyPrompt
      const result = await generateScenesServer({
        data: { story, accessToken },
      })
      setScenes(result.scenes)
      setCharacters(result.characters)
      setStatus('scenes_generated')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scene generation failed'
      console.error('Scene generation failed:', err)
      setError(msg)
    } finally {
      setIsGeneratingScenes(false)
    }
  }, [accessToken, storyPrompt, refinedStory])

  const updateScene = useCallback(
    (sceneId: string, updates: Partial<Scene>) => {
      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)),
      )
    },
    [],
  )

  const updateCharacter = useCallback(
    (slug: string, updates: Partial<StoryboardCharacter>) => {
      setCharacters((prev) =>
        prev.map((c) => (c.slug === slug ? { ...c, ...updates } : c)),
      )
    },
    [],
  )

  const generateCharacterRefAction = useCallback(
    async (slug: string, promptOverride?: string) => {
      const character = characters.find((c) => c.slug === slug)
      if (!character || !accessToken || !storyboardId) return

      setGeneratingCharacterSlugs((prev) => new Set(prev).add(slug))

      try {
        const existingRefUrls = character.reference_images
          .map((img) => img.url)
          .filter((url): url is string => !!url)

        const result = await generateCharacterRefServer({
          data: {
            characterSlug: slug,
            characterDescription: character.description,
            existingRefUrls:
              existingRefUrls.length > 0 ? existingRefUrls : undefined,
            promptOverride,
            storyboardId,
            accessToken,
          },
        })

        charRefGen.addPendingResult({
          id: result.recordId,
          status: 'pending',
          label: `Ref: ${character.name}`,
        })
      } catch (err) {
        console.error('Character ref generation failed:', err)
        setGeneratingCharacterSlugs((prev) => {
          const next = new Set(prev)
          next.delete(slug)
          return next
        })
      }
    },
    [characters, accessToken, storyboardId, charRefGen],
  )

  const addCharacterRefImage = useCallback(
    (slug: string, image: { id: string; url: string | null }) => {
      setCharacters((prev) =>
        prev.map((c) =>
          c.slug === slug
            ? {
                ...c,
                reference_images: [...c.reference_images, image].slice(0, 14),
              }
            : c,
        ),
      )
    },
    [],
  )

  const generateFrame = useCallback(
    async (sceneId: string) => {
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !accessToken || !storyboardId) return

      setGeneratingSceneIds((prev) => new Set(prev).add(sceneId))

      // Gather character ref image URLs for this scene
      const characterImageUrls: Array<string> = []
      for (const charSlug of scene.characters) {
        const character = characters.find((c) => c.slug === charSlug)
        if (character) {
          for (const img of character.reference_images) {
            if (img.url) characterImageUrls.push(img.url)
          }
        }
      }

      try {
        const result = await generateFrameServer({
          data: {
            visualDescription: scene.visual_description,
            sceneId,
            storyboardId,
            accessToken,
            modelId: frameModelId,
            characterImageUrls:
              characterImageUrls.length > 0 ? characterImageUrls : undefined,
          },
        })

        frameGen.addPendingResult({
          id: result.recordId,
          status: 'pending',
          label: `Scene ${scene.scene_number}`,
        })
      } catch (err) {
        console.error('Frame generation failed:', err)
        setGeneratingSceneIds((prev) => {
          const next = new Set(prev)
          next.delete(sceneId)
          return next
        })
      }
    },
    [scenes, characters, accessToken, storyboardId, frameModelId, frameGen],
  )

  const generateAllFrames = useCallback(async () => {
    for (const scene of scenes) {
      if (!scene.image_id) {
        await generateFrame(scene.id)
      }
    }
  }, [scenes, generateFrame])

  const save = useCallback(async () => {
    if (!accessToken || !storyPrompt.trim()) return
    setIsSaving(true)
    try {
      const result = await saveStoryboardServer({
        data: {
          accessToken,
          id: storyboardId ?? undefined,
          story_prompt: storyPrompt,
          refined_story: refinedStory,
          scenes,
          characters,
          status,
        },
      })
      if (result.storyboard?.id && !storyboardId) {
        setStoryboardId(result.storyboard.id)
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [
    accessToken,
    storyboardId,
    storyPrompt,
    refinedStory,
    scenes,
    characters,
    status,
  ])

  // Auto-save after scene/character changes
  const prevScenesRef = useRef(scenes)
  const prevCharactersRef = useRef(characters)
  useEffect(() => {
    const scenesChanged = scenes !== prevScenesRef.current && scenes.length > 0
    const charsChanged =
      characters !== prevCharactersRef.current && characters.length > 0
    if ((scenesChanged || charsChanged) && !isSaving) {
      prevScenesRef.current = scenes
      prevCharactersRef.current = characters
      const timer = setTimeout(() => {
        save()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [scenes, characters, isSaving, save])

  const reset = useCallback(() => {
    setStoryboardId(null)
    setStoryPrompt(SAMPLE_STORY)
    setRefinedStory(null)
    setScenes([])
    setCharacters([])
    setStatus('draft')
    setGeneratingSceneIds(new Set())
    setGeneratingCharacterSlugs(new Set())
    processedIdsRef.current.clear()
    processedCharRefIdsRef.current.clear()
  }, [])

  return useMemo(
    () => ({
      storyboardId,
      storyPrompt,
      refinedStory,
      scenes,
      characters,
      status,
      frameModelId,
      isRefining,
      isGeneratingScenes,
      isSaving,
      isLoading,
      error,
      hasScenes: scenes.length > 0,
      generatingSceneIds,
      generatingCharacterSlugs,
      setStoryPrompt,
      refineStory,
      generateScenes: generateScenesAction,
      updateScene,
      updateCharacter,
      generateCharacterRef: generateCharacterRefAction,
      addCharacterRefImage,
      generateFrame,
      generateAllFrames,
      setFrameModelId,
      save,
      reset,
    }),
    [
      storyboardId,
      storyPrompt,
      refinedStory,
      scenes,
      characters,
      status,
      frameModelId,
      isRefining,
      isGeneratingScenes,
      isSaving,
      isLoading,
      error,
      generatingSceneIds,
      generatingCharacterSlugs,
      refineStory,
      generateScenesAction,
      updateScene,
      updateCharacter,
      generateCharacterRefAction,
      addCharacterRefImage,
      generateFrame,
      generateAllFrames,
      save,
      reset,
    ],
  )
}
