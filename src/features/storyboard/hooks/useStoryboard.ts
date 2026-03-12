import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refineStory as refineStoryServer } from '../server/refine-story.server'
import { generateScenes as generateScenesServer } from '../server/generate-scenes.server'
import { generateStoryboardFrame as generateFrameServer } from '../server/generate-storyboard-frame.server'
import { saveStoryboard as saveStoryboardServer } from '../server/save-storyboard.server'
import { loadStoryboard as loadStoryboardServer } from '../server/load-storyboard.server'
import type { Scene, StoryboardStatus } from '../types'
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
  // Actions
  setStoryPrompt: (text: string) => void
  refineStory: () => void
  generateScenes: () => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
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

  // Track frame generations via existing hook
  const frameGen = useGenerationResults({
    userId,
    accessToken,
    generationType: 'storyboard_frame',
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

        // Find which scene this frame belongs to by checking generation_metadata
        // We need to query the DB for the metadata since useGenerationResults doesn't expose it
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

  const generateFrame = useCallback(
    async (sceneId: string) => {
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !accessToken || !storyboardId) return

      setGeneratingSceneIds((prev) => new Set(prev).add(sceneId))

      try {
        const result = await generateFrameServer({
          data: {
            visualDescription: scene.visual_description,
            sceneId,
            storyboardId,
            accessToken,
            modelId: frameModelId,
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
    [scenes, accessToken, storyboardId, frameModelId, frameGen],
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
  }, [accessToken, storyboardId, storyPrompt, refinedStory, scenes, status])

  // Auto-save after scene generation and frame completions
  const prevScenesRef = useRef(scenes)
  useEffect(() => {
    if (scenes.length > 0 && scenes !== prevScenesRef.current && !isSaving) {
      prevScenesRef.current = scenes
      // Debounced save
      const timer = setTimeout(() => {
        save()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [scenes, isSaving, save])

  const reset = useCallback(() => {
    setStoryboardId(null)
    setStoryPrompt(SAMPLE_STORY)
    setRefinedStory(null)
    setScenes([])
    setStatus('draft')
    setGeneratingSceneIds(new Set())
    processedIdsRef.current.clear()
  }, [])

  return useMemo(
    () => ({
      storyboardId,
      storyPrompt,
      refinedStory,
      scenes,
      status,
      frameModelId,
      isRefining,
      isGeneratingScenes,
      isSaving,
      isLoading,
      error,
      hasScenes: scenes.length > 0,
      generatingSceneIds,
      setStoryPrompt,
      refineStory,
      generateScenes: generateScenesAction,
      updateScene,
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
      status,
      frameModelId,
      isRefining,
      isGeneratingScenes,
      isSaving,
      isLoading,
      error,
      generatingSceneIds,
      refineStory,
      generateScenesAction,
      updateScene,
      generateFrame,
      generateAllFrames,
      save,
      reset,
    ],
  )
}
