import { useCallback, useEffect, useRef, useState } from 'react'
import { describeImage } from '../server/describe-image.server'
import { generateFromDescription } from '../server/generate-from-description.server'
import type { SelectedImage } from '../types'
import type { GenerationResult } from '@/lib/types/generation-result'
import { useAuth } from '@/lib/auth'
import { useGenerationResults } from '@/lib/hooks/useGenerationResults'
import { getModelName } from '@/features/ai-images/models'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { CREDIT_COSTS } from '@/features/credits'
import { isCreditError } from '@/features/credits/handle-credit-error'

type PipelineStatus =
  | 'idle'
  | 'selecting'
  | 'describing'
  | 'generating'
  | 'pending'
  | 'error'

export interface DescriberModel {
  id: string
  name: string
}

export const DESCRIBER_MODELS: Array<DescriberModel> = [
  { id: 'fal-ai/flux/schnell', name: 'FLUX Schnell' },
  { id: 'fal-ai/flux/dev', name: 'FLUX Dev' },
  { id: 'fal-ai/flux-2-flex', name: 'FLUX.2 Flex' },
  { id: 'fal-ai/imagen3/fast', name: 'Imagen 3 Fast' },
  { id: 'fal-ai/imagen3', name: 'Imagen 3' },
  { id: 'fal-ai/imagen4/preview', name: 'Imagen 4' },
]

interface ImageDescriberState {
  status: PipelineStatus
  sourceImage: SelectedImage | null
  sourceFile: File | null
  description: string | null
  latestRecordId: string | null
  error: string | null
}

const INITIAL_STATE: ImageDescriberState = {
  status: 'idle',
  sourceImage: null,
  sourceFile: null,
  description: null,
  latestRecordId: null,
  error: null,
}

export interface UseImageDescriberReturn {
  status: PipelineStatus
  sourceImage: SelectedImage | null
  description: string | null
  generatedImageUrl: string | null
  error: string | null
  model: string
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  setOrientation: (o: 'landscape' | 'portrait') => void
  recentResults: Array<GenerationResult>
  deleteResult: (id: string) => Promise<void>
  selectImage: (image: SelectedImage) => void
  selectFile: (file: File) => void
  setModel: (model: string) => void
  setAspectRatio: (ratio: string) => void
  regenerateDescription: () => void
  regenerateImage: () => void
  reset: () => void
}

export function useImageDescriber(): UseImageDescriberReturn {
  const { user, session } = useAuth()
  const credits = useCredits()
  const accessToken = session?.access_token ?? ''
  const [state, setState] = useState<ImageDescriberState>(INITIAL_STATE)
  const [model, setModel] = useState(DESCRIBER_MODELS[0].id)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const abortRef = useRef(false)
  const genTrigger = useRef(0)
  const [genCount, setGenCount] = useState(0)

  const {
    results: recentResults,
    addPendingResult,
    replaceTempId,
    deleteResult,
  } = useGenerationResults({
    userId: user?.id,
    accessToken,
    generationType: 'describe',
  })

  // Derive generatedImageUrl from the latest result matching latestRecordId
  const latestResult = state.latestRecordId
    ? recentResults.find((r) => r.id === state.latestRecordId)
    : undefined
  const generatedImageUrl =
    latestResult?.status === 'complete' ? (latestResult.url ?? null) : null

  const selectImage = useCallback((image: SelectedImage) => {
    setState({
      status: 'describing',
      sourceImage: image,
      sourceFile: null,
      description: null,
      latestRecordId: null,
      error: null,
    })
  }, [])

  const selectFile = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file)
    setState({
      status: 'describing',
      sourceImage: { id: objectUrl, url: objectUrl, title: file.name },
      sourceFile: file,
      description: null,
      latestRecordId: null,
      error: null,
    })
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    setState(INITIAL_STATE)
  }, [])

  const regenerateDescription = useCallback(() => {
    if (!state.sourceImage) return
    abortRef.current = true
    setState((s) => ({
      ...s,
      status: 'describing',
      description: null,
      latestRecordId: null,
      error: null,
    }))
  }, [state.sourceImage])

  const regenerateImage = useCallback(() => {
    if (!state.description) return
    abortRef.current = true
    setState((s) => ({
      ...s,
      status: 'generating',
      latestRecordId: null,
      error: null,
    }))
    genTrigger.current += 1
    setGenCount(genTrigger.current)
  }, [state.description])

  // Auto-describe when sourceImage is set
  useEffect(() => {
    if (state.status !== 'describing' || !state.sourceImage) return

    if (!accessToken) return

    abortRef.current = false

    void (async () => {
      try {
        let imageUrl = state.sourceImage!.url
        if (state.sourceFile) {
          imageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsDataURL(state.sourceFile!)
          })
        }

        const result = await describeImage({
          data: { imageUrl, accessToken },
        })
        if (abortRef.current) return
        setState((s) => ({
          ...s,
          status: 'generating',
          description: result.description,
        }))
      } catch (err) {
        if (abortRef.current) return
        setState((s) => ({
          ...s,
          status: 'error',
          error:
            err instanceof Error ? err.message : 'Failed to describe image',
        }))
      }
    })()
  }, [state.status, state.sourceImage, state.sourceFile, accessToken])

  // Auto-generate when description is received (or regenerate triggered)
  useEffect(() => {
    if (state.status !== 'generating' || !state.description) return

    if (!accessToken) return

    const cost = CREDIT_COSTS.image_gen
    if (credits.balance !== null && credits.balance < cost) {
      credits.showInsufficientCredits(cost)
      setState((s) => ({ ...s, status: 'error', error: null }))
      return
    }

    abortRef.current = false

    const tempId = `temp-describe-${Date.now()}`

    addPendingResult({
      id: tempId,
      status: 'pending',
      label: getModelName(model),
      prompt: state.description,
    })

    void (async () => {
      try {
        const result = await generateFromDescription({
          data: {
            prompt: state.description!,
            accessToken,
            model,
            aspectRatio,
          },
        })
        if (abortRef.current) return
        replaceTempId(tempId, result.recordId)
        setState((s) => ({
          ...s,
          status: 'pending',
          latestRecordId: result.recordId,
        }))
      } catch (err) {
        if (abortRef.current) return
        if (isCreditError(err)) {
          credits.showInsufficientCredits(cost)
          setState((s) => ({ ...s, status: 'error', error: null }))
        } else {
          setState((s) => ({
            ...s,
            status: 'error',
            error:
              err instanceof Error ? err.message : 'Failed to generate image',
          }))
        }
      }
    })()
    // genCount included to re-trigger on regenerate
  }, [
    state.status,
    state.description,
    accessToken,
    model,
    aspectRatio,
    genCount,
    credits,
    addPendingResult,
    replaceTempId,
  ])

  // Derive effective status: if we're pending and the result completed, reflect that
  const effectiveStatus =
    state.status === 'pending' && generatedImageUrl ? 'pending' : state.status

  return {
    status: effectiveStatus,
    sourceImage: state.sourceImage,
    description: state.description,
    generatedImageUrl,
    error: state.error,
    model,
    orientation,
    aspectRatio,
    setOrientation,
    recentResults,
    deleteResult,
    selectImage,
    selectFile,
    setModel,
    setAspectRatio,
    regenerateDescription,
    regenerateImage,
    reset,
  }
}
