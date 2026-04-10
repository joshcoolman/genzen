import { useCallback, useState } from 'react'
import type {
  SavedAiVideo,
  VideoElement,
  VideoMethod,
  VideoShot,
} from '@/features/ai-video/video-types'
import { generateVideo } from '@/features/ai-video/server/generate-video.server'
import { DEFAULT_VIDEO_MODEL } from '@/features/ai-video/video-models'

/**
 * Sidebar state holds only the ACTIVE mode's fields. Switching modes does NOT
 * retain hidden state -- anything non-overlapping is dropped when you toggle.
 * This matches the user's mental model: "edit view is just a focused view +
 * assumed grouping; clicking a thumbnail is a convenience to pre-fill the
 * sidebar; any gen is a brand new video with its own snapshot."
 */
export interface VideoSidebarState {
  mode: VideoMethod
  // Frame state (FLF "first frame" doubles as multishot "start image")
  firstFrameUrl: string | null
  firstFrameRecordId: string | null
  lastFrameUrl: string | null
  lastFrameRecordId: string | null
  // FLF prompt + settings
  prompt: string
  duration: string
  cfgScale: number
  negativePrompt: string
  videoModel: string
  // Multishot-only
  shots: Array<VideoShot>
  elements: Array<VideoElement>
  aspectRatio: '16:9' | '9:16' | '1:1'
  shotType: 'customize' | 'intelligent'
  generateAudio: boolean
}

const DEFAULT_STATE: VideoSidebarState = {
  mode: 'flf',
  firstFrameUrl: null,
  firstFrameRecordId: null,
  lastFrameUrl: null,
  lastFrameRecordId: null,
  prompt: '',
  duration: '5',
  cfgScale: 0.5,
  negativePrompt: '',
  videoModel: DEFAULT_VIDEO_MODEL,
  shots: [{ id: crypto.randomUUID(), prompt: '', duration: 5 }],
  elements: [],
  aspectRatio: '16:9',
  shotType: 'customize',
  generateAudio: true,
}

interface UseVideoSidebarOptions {
  accessToken: string | undefined
  /** Sticky parent id for the current edit session. Null on main page. */
  sessionParentId?: string | null
  /** Called after a successful gen. Useful for gallery refresh / highlight. */
  onGenerated?: (result: { recordId: string; requestId: string }) => void
}

export interface UseVideoSidebarReturn extends VideoSidebarState {
  setMode: (mode: VideoMethod) => void
  setFirstFrame: (url: string | null, recordId?: string | null) => void
  setLastFrame: (url: string | null, recordId?: string | null) => void
  setPrompt: (prompt: string) => void
  setDuration: (duration: string) => void
  setCfgScale: (cfg: number) => void
  setNegativePrompt: (p: string) => void
  setVideoModel: (id: string) => void
  addShot: () => void
  removeShot: (id: string) => void
  updateShot: (
    id: string,
    updates: Partial<Pick<VideoShot, 'prompt' | 'duration'>>,
  ) => void
  replaceElements: (urls: Array<string>) => void
  removeElement: (id: string) => void
  setAspectRatio: (ar: '16:9' | '9:16' | '1:1') => void
  setShotType: (t: 'customize' | 'intelligent') => void
  setGenerateAudio: (b: boolean) => void
  clearPrompts: () => void
  reset: () => void
  /** Rehydrate from a saved video's generation_metadata snapshot. */
  loadFromVideo: (video: SavedAiVideo) => void
  /** Fire a generation with current state. */
  generate: () => Promise<{ recordId: string; requestId: string } | null>
  generating: boolean
  error: string | null
}

/** Clamp a multishot shot duration so total ≤ 15s and each ≥ 3s. */
function clampShotDuration(
  shots: Array<VideoShot>,
  id: string,
  next: number,
): Array<VideoShot> {
  const MAX_TOTAL = 15
  const MIN = 3
  return shots.map((s) => {
    if (s.id !== id) return s
    const otherTotal = shots
      .filter((o) => o.id !== id)
      .reduce((sum, o) => sum + o.duration, 0)
    const cap = MAX_TOTAL - otherTotal
    return { ...s, duration: Math.max(MIN, Math.min(next, cap)) }
  })
}

export function useVideoSidebar({
  accessToken,
  sessionParentId,
  onGenerated,
}: UseVideoSidebarOptions): UseVideoSidebarReturn {
  const [state, setState] = useState<VideoSidebarState>(DEFAULT_STATE)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setMode = useCallback((mode: VideoMethod) => {
    setState((prev) => {
      if (prev.mode === mode) return prev
      // First frame / start image is a shared slot so it survives the toggle.
      // Nothing else maps cleanly -- switching drops fields from the outgoing mode.
      return { ...prev, mode }
    })
  }, [])

  const setFirstFrame = useCallback(
    (url: string | null, recordId?: string | null) => {
      setState((prev) => ({
        ...prev,
        firstFrameUrl: url,
        firstFrameRecordId: recordId ?? null,
      }))
    },
    [],
  )

  const setLastFrame = useCallback(
    (url: string | null, recordId?: string | null) => {
      setState((prev) => ({
        ...prev,
        lastFrameUrl: url,
        lastFrameRecordId: recordId ?? null,
      }))
    },
    [],
  )

  const setPrompt = useCallback((prompt: string) => {
    setState((prev) => ({ ...prev, prompt }))
  }, [])

  const setDuration = useCallback((duration: string) => {
    setState((prev) => ({ ...prev, duration }))
  }, [])

  const setCfgScale = useCallback((cfg: number) => {
    setState((prev) => ({ ...prev, cfgScale: cfg }))
  }, [])

  const setNegativePrompt = useCallback((p: string) => {
    setState((prev) => ({ ...prev, negativePrompt: p }))
  }, [])

  const setVideoModel = useCallback((id: string) => {
    setState((prev) => ({ ...prev, videoModel: id }))
  }, [])

  const addShot = useCallback(() => {
    setState((prev) => {
      if (prev.shots.length >= 6) return prev
      const used = prev.shots.reduce((sum, s) => sum + s.duration, 0)
      const remaining = 15 - used
      if (remaining < 3) return prev
      return {
        ...prev,
        shots: [
          ...prev.shots,
          {
            id: crypto.randomUUID(),
            prompt: '',
            duration: Math.min(5, remaining),
          },
        ],
      }
    })
  }, [])

  const removeShot = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      shots:
        prev.shots.length <= 1
          ? prev.shots
          : prev.shots.filter((s) => s.id !== id),
    }))
  }, [])

  const updateShot = useCallback(
    (id: string, updates: Partial<Pick<VideoShot, 'prompt' | 'duration'>>) => {
      setState((prev) => {
        let nextShots = prev.shots.map((s) =>
          s.id === id ? { ...s, ...updates } : s,
        )
        if (updates.duration !== undefined) {
          nextShots = clampShotDuration(prev.shots, id, updates.duration)
        }
        return { ...prev, shots: nextShots }
      })
    },
    [],
  )

  const replaceElements = useCallback((urls: Array<string>) => {
    setState((prev) => ({
      ...prev,
      elements: urls.map((url, i) => ({
        id: crypto.randomUUID(),
        frontalImageUrl: url,
        label: `@Element${i + 1}`,
      })),
    }))
  }, [])

  const removeElement = useCallback((id: string) => {
    setState((prev) => {
      const filtered = prev.elements.filter((e) => e.id !== id)
      return {
        ...prev,
        elements: filtered.map((e, i) => ({ ...e, label: `@Element${i + 1}` })),
      }
    })
  }, [])

  const setAspectRatio = useCallback((ar: '16:9' | '9:16' | '1:1') => {
    setState((prev) => ({ ...prev, aspectRatio: ar }))
  }, [])

  const setShotType = useCallback((t: 'customize' | 'intelligent') => {
    setState((prev) => ({ ...prev, shotType: t }))
  }, [])

  const setGenerateAudio = useCallback((b: boolean) => {
    setState((prev) => ({ ...prev, generateAudio: b }))
  }, [])

  const clearPrompts = useCallback(() => {
    setState((prev) => {
      if (prev.mode === 'flf') {
        return { ...prev, prompt: '' }
      }
      return {
        ...prev,
        shots: prev.shots.map((s) => ({ ...s, prompt: '' })),
      }
    })
  }, [])

  const reset = useCallback(() => {
    setState(DEFAULT_STATE)
    setError(null)
  }, [])

  const loadFromVideo = useCallback((video: SavedAiVideo) => {
    const meta = video.generation_metadata
    if (!meta) return

    const method: VideoMethod =
      meta.method === 'multishot' || meta.type === 'multishot'
        ? 'multishot'
        : 'flf'

    if (method === 'flf') {
      setState((prev) => ({
        ...prev,
        mode: 'flf',
        firstFrameUrl:
          (meta as { first_frame_url?: string }).first_frame_url ?? null,
        firstFrameRecordId:
          (meta as { first_frame_id?: string }).first_frame_id ?? null,
        lastFrameUrl:
          (meta as { last_frame_url?: string }).last_frame_url ?? null,
        lastFrameRecordId:
          (meta as { last_frame_id?: string }).last_frame_id ?? null,
        prompt:
          (meta as { transition_prompt?: string }).transition_prompt ??
          (meta as { prompt?: string }).prompt ??
          '',
        duration: (meta as { duration?: string }).duration ?? '5',
        cfgScale: (meta as { cfg_scale?: number }).cfg_scale ?? 0.5,
        negativePrompt:
          (meta as { negative_prompt?: string }).negative_prompt ?? '',
        videoModel: (meta as { model?: string }).model ?? DEFAULT_VIDEO_MODEL,
      }))
    } else {
      const msMeta = meta as {
        shots?: Array<VideoShot>
        elements?: Array<VideoElement>
        start_image_url?: string
        aspect_ratio?: '16:9' | '9:16' | '1:1'
        shot_type?: 'customize' | 'intelligent'
        generate_audio?: boolean
      }
      setState((prev) => ({
        ...prev,
        mode: 'multishot',
        firstFrameUrl: msMeta.start_image_url ?? null,
        firstFrameRecordId: null,
        shots:
          msMeta.shots && msMeta.shots.length > 0
            ? msMeta.shots.map((s) => ({
                id: s.id || crypto.randomUUID(),
                prompt: s.prompt,
                duration: s.duration,
              }))
            : prev.shots,
        elements: (msMeta.elements ?? []).map((e) => ({
          id: e.id || crypto.randomUUID(),
          frontalImageUrl: e.frontalImageUrl,
          label: e.label,
        })),
        aspectRatio: msMeta.aspect_ratio ?? '16:9',
        shotType: msMeta.shot_type ?? 'customize',
        generateAudio: msMeta.generate_audio ?? true,
      }))
    }
    setError(null)
  }, [])

  const generate = useCallback(async () => {
    if (!accessToken) return null
    setError(null)

    if (state.mode === 'flf') {
      if (!state.firstFrameRecordId) {
        setError('Add a first frame before generating')
        return null
      }
      setGenerating(true)
      try {
        const result = await generateVideo({
          data: {
            accessToken,
            parentId: sessionParentId ?? null,
            method: 'flf',
            firstFrameRecordId: state.firstFrameRecordId,
            firstFrameUrl: state.firstFrameUrl,
            lastFrameRecordId: state.lastFrameRecordId,
            lastFrameUrl: state.lastFrameUrl,
            prompt: state.prompt,
            duration: state.duration,
            cfgScale: state.cfgScale,
            negativePrompt: state.negativePrompt,
            videoModel: state.videoModel,
          },
        })
        onGenerated?.(result)
        return result
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to generate video',
        )
        return null
      } finally {
        setGenerating(false)
      }
    } else {
      if (!state.firstFrameUrl) {
        setError('A start image is required for multi-shot generation')
        return null
      }
      if (state.shots.every((s) => !s.prompt.trim())) {
        setError('At least one shot needs a prompt')
        return null
      }
      setGenerating(true)
      try {
        const result = await generateVideo({
          data: {
            accessToken,
            parentId: sessionParentId ?? null,
            method: 'multishot',
            startImageUrl: state.firstFrameUrl,
            shots: state.shots,
            elements: state.elements,
            aspectRatio: state.aspectRatio,
            shotType: state.shotType,
            generateAudio: state.generateAudio,
          },
        })
        onGenerated?.(result)
        return result
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to generate multi-shot',
        )
        return null
      } finally {
        setGenerating(false)
      }
    }
  }, [accessToken, sessionParentId, state, onGenerated])

  return {
    ...state,
    setMode,
    setFirstFrame,
    setLastFrame,
    setPrompt,
    setDuration,
    setCfgScale,
    setNegativePrompt,
    setVideoModel,
    addShot,
    removeShot,
    updateShot,
    replaceElements,
    removeElement,
    setAspectRatio,
    setShotType,
    setGenerateAudio,
    clearPrompts,
    reset,
    loadFromVideo,
    generate,
    generating,
    error,
  }
}
