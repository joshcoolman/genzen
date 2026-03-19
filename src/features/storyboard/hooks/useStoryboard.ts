import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refineStory as refineStoryServer } from '../server/refine-story.server'
import { generateScenes as generateScenesServer } from '../server/generate-scenes.server'
import { generateStoryboardFrame as generateFrameServer } from '../server/generate-storyboard-frame.server'
import { generateCharacterRef as generateCharacterRefServer } from '../server/generate-character-ref.server'
import { generateStoryboardClip as generateClipServer } from '../server/generate-storyboard-video.server'
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
  // Loading states
  isRefining: boolean
  isGeneratingScenes: boolean
  isGeneratingVideo: boolean
  isSaving: boolean
  isLoading: boolean
  error: string | null
  videoError: string | null
  // Derived
  hasScenes: boolean
  allFramesReady: boolean
  generatingSceneIds: Set<string>
  generatingSceneCounts: Map<string, number>
  generatingCharacterSlugs: Set<string>
  // Video
  videoClipIds: Array<string>
  videoClipUrls: Array<string>
  videoUrl: string | null
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
  generateFrame: (sceneId: string, count?: number) => void
  selectFrame: (sceneId: string, frameId: string) => void
  addFrameFromLibrary: (
    sceneId: string,
    image: { id: string; url: string | null },
  ) => void
  addSceneRefImage: (
    sceneId: string,
    image: { id: string; url: string | null },
  ) => void
  removeSceneRefImage: (sceneId: string, imageId: string) => void
  clips: Array<{ scenes: Array<Scene>; totalDuration: number }>
  generatingClipIndices: Set<number>
  generateClip: (clipIndex: number) => void
  generateAllClips: () => void
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
  const [isRefining, setIsRefining] = useState(false)
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingSceneCounts, setGeneratingSceneCounts] = useState<
    Map<string, number>
  >(new Map())
  const [generatingCharacterSlugs, setGeneratingCharacterSlugs] = useState<
    Set<string>
  >(new Set())
  const [videoClipIds, setVideoClipIds] = useState<Array<string>>([])
  const [videoClipUrls, setVideoClipUrls] = useState<Map<string, string>>(
    new Map(),
  )
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [generatingClipIndices, setGeneratingClipIndices] = useState<
    Set<number>
  >(new Set())

  // Derived set for backward compat
  const generatingSceneIds = useMemo(
    () => new Set(generatingSceneCounts.keys()),
    [generatingSceneCounts],
  )

  // Derive ordered video clip URLs array
  const videoClipUrlsArray = useMemo(
    () =>
      videoClipIds
        .map((id) => videoClipUrls.get(id))
        .filter((u): u is string => !!u),
    [videoClipIds, videoClipUrls],
  )

  // Single videoUrl for backward compat (first clip)
  const videoUrl = videoClipUrlsArray.length > 0 ? videoClipUrlsArray[0] : null

  // All scenes have a selected frame
  const allFramesReady = useMemo(
    () => scenes.length >= 2 && scenes.every((s) => s.image_id !== null),
    [scenes],
  )

  // Compute video clips: group consecutive scenes into chunks <= 15s
  const MAX_CLIP_DURATION = 15
  const clips = useMemo(() => {
    const result: Array<{ scenes: Array<Scene>; totalDuration: number }> = []
    let current: Array<Scene> = []
    let currentDuration = 0
    for (const scene of scenes) {
      const d = scene.duration_seconds
      if (current.length > 0 && currentDuration + d > MAX_CLIP_DURATION) {
        result.push({ scenes: current, totalDuration: currentDuration })
        current = []
        currentDuration = 0
      }
      current.push(scene)
      currentDuration += d
    }
    if (current.length > 0) {
      result.push({ scenes: current, totalDuration: currentDuration })
    }
    return result
  }, [scenes])

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

            const newFrame = { id: result.id, url: result.url ?? null }

            setScenes((prev) =>
              prev.map((s) => {
                if (s.id !== sceneId) return s
                // Skip if frame already exists (e.g. loaded from saved data)
                if (s.generated_frames.some((f) => f.id === newFrame.id))
                  return s
                const updated = {
                  ...s,
                  generated_frames: [...s.generated_frames, newFrame],
                }
                // Auto-select first frame if none selected
                if (!s.image_id) {
                  updated.image_id = result.id
                  updated.image_url = result.url ?? null
                }
                return updated
              }),
            )
            setGeneratingSceneCounts((prev) => {
              const next = new Map(prev)
              const current = next.get(sceneId) ?? 0
              if (current <= 1) {
                next.delete(sceneId)
              } else {
                next.set(sceneId, current - 1)
              }
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
              prev.map((c) => {
                if (c.slug !== slug) return c
                // Skip if ref already exists (e.g. loaded from saved data)
                if (c.reference_images.some((img) => img.id === result.id))
                  return c
                return {
                  ...c,
                  reference_images: [
                    ...c.reference_images,
                    { id: result.id, url: result.url ?? null },
                  ],
                }
              }),
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
          const rawScenes = (
            Array.isArray(storyboard.scenes)
              ? storyboard.scenes
              : JSON.parse(storyboard.scenes as unknown as string)
          ) as Array<
            Omit<Scene, 'generated_frames'> & {
              generated_frames?: Scene['generated_frames']
            }
          >
          // Normalize: backfill generated_frames, deduplicate, strip stale URLs
          setScenes(
            rawScenes.map((s) => {
              const rawFrames =
                s.generated_frames ??
                (s.image_id ? [{ id: s.image_id, url: null }] : [])
              // Deduplicate frames by id
              const seenIds = new Set<string>()
              const dedupedFrames = rawFrames.filter((f: any) => {
                if (seenIds.has(f.id)) return false
                seenIds.add(f.id)
                return true
              })
              return {
                ...s,
                lighting: (s as any).lighting ?? '',
                lens: (s as any).lens ?? '',
                angle: (s as any).angle ?? 'eye level',
                generation_notes: (s as any).generation_notes ?? '',
                reference_images: ((s as any).reference_images ?? []).map(
                  (img: any) => ({ id: img.id, url: null }),
                ),
                image_url: null,
                generated_frames: dedupedFrames.map((f: any) => ({
                  id: f.id,
                  url: null,
                })),
              }
            }),
          )
          const chars = storyboard.characters
          const parsedChars = Array.isArray(chars)
            ? chars
            : typeof chars === 'string'
              ? JSON.parse(chars)
              : []
          // Deduplicate and strip stale character ref URLs
          setCharacters(
            parsedChars.map((c: any) => {
              const seen = new Set<string>()
              const deduped = (c.reference_images ?? []).filter((img: any) => {
                if (seen.has(img.id)) return false
                seen.add(img.id)
                return true
              })
              return {
                ...c,
                reference_images: deduped.map((img: any) => ({
                  id: img.id,
                  url: null,
                })),
              }
            }),
          )
          setStatus(storyboard.status)
          // Restore video clips — find all storyboard_video records for this storyboard
          if (storyboard.video_record_id) {
            supabase
              .from('user_images')
              .select('id, status, generation_metadata')
              .eq('source', 'ai_video')
              .eq('user_id', userId!)
              .filter(
                'generation_metadata->>storyboard_id',
                'eq',
                storyboard.id,
              )
              .filter(
                'generation_metadata->>generation_type',
                'eq',
                'storyboard_video',
              )
              .order('created_at', { ascending: true })
              .then(({ data: clipRecords }) => {
                if (!clipRecords?.length) return
                const ids = clipRecords.map((r) => r.id)
                setVideoClipIds(ids)
                const urlMap = new Map<string, string>()
                for (const r of clipRecords) {
                  if (r.status === 'completed') {
                    const meta = r.generation_metadata as Record<
                      string,
                      unknown
                    > | null
                    const falUrl = meta?.fal_url as string | undefined
                    if (falUrl) urlMap.set(r.id, falUrl)
                  }
                }
                if (urlMap.size > 0) setVideoClipUrls(urlMap)
              })
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [accessToken])

  // Resolve image URLs for scenes — image_id, generated_frames, and reference_images
  useEffect(() => {
    const idsNeeding: Array<string> = []
    for (const s of scenes) {
      if (s.image_id && !s.image_url) idsNeeding.push(s.image_id)
      for (const f of s.generated_frames) {
        if (f.id && !f.url && !idsNeeding.includes(f.id)) idsNeeding.push(f.id)
      }
      for (const ref of s.reference_images) {
        if (ref.id && !ref.url && !idsNeeding.includes(ref.id))
          idsNeeding.push(ref.id)
      }
    }
    if (idsNeeding.length === 0) return

    supabase
      .from('user_images')
      .select('id, storage_path')
      .in('id', idsNeeding)
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
                .createSignedUrl(r.storage_path, 86400, {
                  transform: { width: 300, quality: 80 },
                })
              if (signed) urlMap[r.id] = signed.signedUrl
            }),
        )
        setScenes((prev) =>
          prev.map((s) => ({
            ...s,
            image_url:
              s.image_id && urlMap[s.image_id]
                ? urlMap[s.image_id]
                : s.image_url,
            generated_frames: s.generated_frames.map((f) =>
              f.id && urlMap[f.id] ? { ...f, url: urlMap[f.id] } : f,
            ),
            reference_images: s.reference_images.map((ref) =>
              ref.id && urlMap[ref.id] ? { ...ref, url: urlMap[ref.id] } : ref,
            ),
          })),
        )
      })
  }, [
    scenes
      .flatMap((s) => [
        `${s.image_id}:${s.image_url}`,
        ...s.generated_frames.map((f) => `${f.id}:${f.url}`),
        ...s.reference_images.map((r) => `${r.id}:${r.url}`),
      ])
      .join(','),
  ])

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
                .createSignedUrl(r.storage_path, 86400, {
                  transform: { width: 300, quality: 80 },
                })
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
    async (sceneId: string, count: number = 1) => {
      const scene = scenes.find((s) => s.id === sceneId)
      if (!scene || !accessToken || !storyboardId) return

      const activeCount = generatingSceneCounts.get(sceneId) ?? 0
      const available = 9 - scene.generated_frames.length - activeCount
      const actualCount = Math.min(Math.max(count, 1), 3, available)
      if (actualCount <= 0) return

      // Increment generating count
      setGeneratingSceneCounts((prev) => {
        const next = new Map(prev)
        next.set(sceneId, (next.get(sceneId) ?? 0) + actualCount)
        return next
      })

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
      // Merge scene-level reference images
      for (const ref of scene.reference_images) {
        if (ref.url && !characterImageUrls.includes(ref.url))
          characterImageUrls.push(ref.url)
      }

      // Build prompt: visual description + generation notes
      let prompt = scene.visual_description
      if (scene.generation_notes.trim()) {
        prompt += `\n\n[Generation notes: ${scene.generation_notes.trim()}]`
      }

      for (let i = 0; i < actualCount; i++) {
        try {
          const result = await generateFrameServer({
            data: {
              visualDescription: prompt,
              framing: scene.framing,
              camera: scene.camera,
              lighting: scene.lighting,
              lens: scene.lens,
              angle: scene.angle,
              sceneId,
              storyboardId,
              accessToken,
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
          setGeneratingSceneCounts((prev) => {
            const next = new Map(prev)
            const current = next.get(sceneId) ?? 0
            if (current <= 1) {
              next.delete(sceneId)
            } else {
              next.set(sceneId, current - 1)
            }
            return next
          })
        }
      }
    },
    [
      scenes,
      characters,
      accessToken,
      storyboardId,
      generatingSceneCounts,
      frameGen,
    ],
  )

  const addFrameFromLibrary = useCallback(
    (sceneId: string, image: { id: string; url: string | null }) => {
      setScenes((prev) =>
        prev.map((s) => {
          if (s.id !== sceneId) return s
          const updated = {
            ...s,
            generated_frames: [...s.generated_frames, image].slice(0, 9),
          }
          // Auto-select if no frame selected
          if (!s.image_id) {
            updated.image_id = image.id
            updated.image_url = image.url
          }
          return updated
        }),
      )
    },
    [],
  )

  const addSceneRefImage = useCallback(
    (sceneId: string, image: { id: string; url: string | null }) => {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                reference_images: [...s.reference_images, image].slice(0, 14),
              }
            : s,
        ),
      )
    },
    [],
  )

  const removeSceneRefImage = useCallback(
    (sceneId: string, imageId: string) => {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                reference_images: s.reference_images.filter(
                  (img) => img.id !== imageId,
                ),
              }
            : s,
        ),
      )
    },
    [],
  )

  const selectFrame = useCallback((sceneId: string, frameId: string) => {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s
        const frame = s.generated_frames.find((f) => f.id === frameId)
        if (!frame) return s
        return { ...s, image_id: frame.id, image_url: frame.url }
      }),
    )
  }, [])

  // Generate a single video clip
  const generateClipAction = useCallback(
    async (clipIndex: number) => {
      const clip = clips[clipIndex] as (typeof clips)[number] | undefined
      if (!clip || !accessToken || !storyboardId) return
      const missingFrame = clip.scenes.some((s) => !s.image_id)
      if (missingFrame) return

      setGeneratingClipIndices((prev) => new Set(prev).add(clipIndex))
      setIsGeneratingVideo(true)
      setVideoError(null)

      try {
        const sceneInputs = clip.scenes.map((s) => ({
          image_id: s.image_id!,
          visual_description: s.visual_description,
          duration_seconds: s.duration_seconds,
          framing: s.framing,
          camera: s.camera,
          lighting: s.lighting,
          lens: s.lens,
          angle: s.angle,
          characters: s.characters,
        }))

        // Gather character refs: first ref image URL per character (deduped)
        const characterRefs: Array<{ slug: string; url: string }> = []
        const seenSlugs = new Set<string>()
        for (const scene of clip.scenes) {
          for (const slug of scene.characters) {
            if (seenSlugs.has(slug)) continue
            seenSlugs.add(slug)
            const char = characters.find((c) => c.slug === slug)
            const firstUrl = char?.reference_images.find((img) => img.url)?.url
            if (firstUrl) characterRefs.push({ slug, url: firstUrl })
          }
        }

        const result = await generateClipServer({
          data: {
            storyboardId,
            accessToken,
            scenes: sceneInputs,
            characterRefs,
            clipIndex,
            clipCount: clips.length,
          },
        })

        setVideoClipIds((prev) => {
          const next = [...prev]
          // Insert at clip position, replacing if re-generating
          next[clipIndex] = result.recordId
          return next
        })
        setStatus('generating_video')
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Video generation failed'
        setVideoError(msg)
      } finally {
        setGeneratingClipIndices((prev) => {
          const next = new Set(prev)
          next.delete(clipIndex)
          if (next.size === 0) setIsGeneratingVideo(false)
          return next
        })
      }
    },
    [clips, characters, accessToken, storyboardId],
  )

  // Generate all clips
  const generateAllClipsAction = useCallback(async () => {
    for (let i = 0; i < clips.length; i++) {
      await generateClipAction(i)
    }
  }, [clips, generateClipAction])

  // Realtime subscription for video clip completion
  useEffect(() => {
    if (videoClipIds.length === 0) return
    // All clips already resolved
    if (videoClipUrls.size >= videoClipIds.length) return
    setIsGeneratingVideo(true)

    const channels = videoClipIds
      .filter((id) => !videoClipUrls.has(id))
      .map((clipId) =>
        supabase
          .channel(`storyboard_clip_${clipId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_images',
              filter: `id=eq.${clipId}`,
            },
            (payload) => {
              const updated = payload.new as {
                status: string
                generation_metadata: Record<string, unknown> | null
              }
              if (updated.status === 'completed') {
                const falUrl = updated.generation_metadata?.fal_url as
                  | string
                  | undefined
                if (falUrl) {
                  setVideoClipUrls((prev) => {
                    const next = new Map(prev)
                    next.set(clipId, falUrl)
                    // Check if all clips are done
                    if (next.size >= videoClipIds.length) {
                      setIsGeneratingVideo(false)
                      setStatus('complete')
                    }
                    return next
                  })
                }
              } else if (updated.status === 'failed') {
                const rawError = updated.generation_metadata?.generation_error
                const errorMsg =
                  typeof rawError === 'string'
                    ? rawError
                    : 'Video clip generation failed'
                setVideoError(errorMsg)
                setIsGeneratingVideo(false)
              }
            },
          )
          .subscribe(),
      )

    return () => {
      for (const ch of channels) {
        supabase.removeChannel(ch)
      }
    }
  }, [videoClipIds, videoClipUrls.size])

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
    setGeneratingSceneCounts(new Map())
    setGeneratingCharacterSlugs(new Set())
    setVideoClipIds([])
    setVideoClipUrls(new Map())
    setIsGeneratingVideo(false)
    setVideoError(null)
    setGeneratingClipIndices(new Set())
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
      isRefining,
      isGeneratingScenes,
      isGeneratingVideo,
      isSaving,
      isLoading,
      error,
      videoError,
      hasScenes: scenes.length > 0,
      allFramesReady,
      generatingSceneIds,
      generatingSceneCounts,
      generatingCharacterSlugs,
      videoClipIds,
      videoClipUrls: videoClipUrlsArray,
      videoUrl,
      setStoryPrompt,
      refineStory,
      generateScenes: generateScenesAction,
      updateScene,
      updateCharacter,
      generateCharacterRef: generateCharacterRefAction,
      addCharacterRefImage,
      generateFrame,
      selectFrame,
      addFrameFromLibrary,
      addSceneRefImage,
      removeSceneRefImage,
      clips,
      generatingClipIndices,
      generateClip: generateClipAction,
      generateAllClips: generateAllClipsAction,
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
      isRefining,
      isGeneratingScenes,
      isGeneratingVideo,
      isSaving,
      isLoading,
      error,
      videoError,
      allFramesReady,
      generatingSceneIds,
      generatingSceneCounts,
      generatingCharacterSlugs,
      videoClipIds,
      videoClipUrlsArray,
      videoUrl,
      clips,
      generatingClipIndices,
      refineStory,
      generateScenesAction,
      updateScene,
      updateCharacter,
      generateCharacterRefAction,
      addCharacterRefImage,
      generateFrame,
      selectFrame,
      addFrameFromLibrary,
      addSceneRefImage,
      removeSceneRefImage,
      generateClipAction,
      generateAllClipsAction,
      save,
      reset,
    ],
  )
}
