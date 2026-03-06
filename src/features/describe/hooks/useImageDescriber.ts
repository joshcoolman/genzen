import { useCallback, useEffect, useRef, useState } from 'react'
import { describeImage } from '../server/describe-image.server'
import { generateFromDescription } from '../server/generate-from-description.server'
import { saveGeneratedImage } from '../server/save-generated-image.server'
import type { SelectedImage } from '../types'
import { useAuth } from '@/lib/auth'

type PipelineStatus =
  | 'idle'
  | 'selecting'
  | 'describing'
  | 'generating'
  | 'complete'
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
  generatedImageUrl: string | null
  error: string | null
}

const INITIAL_STATE: ImageDescriberState = {
  status: 'idle',
  sourceImage: null,
  sourceFile: null,
  description: null,
  generatedImageUrl: null,
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
  isSaving: boolean
  isSaved: boolean
  selectImage: (image: SelectedImage) => void
  selectFile: (file: File) => void
  setModel: (model: string) => void
  setAspectRatio: (ratio: string) => void
  regenerateDescription: () => void
  regenerateImage: () => void
  reset: () => void
  saveImage: () => Promise<void>
}

export function useImageDescriber(): UseImageDescriberReturn {
  const { session } = useAuth()
  const [state, setState] = useState<ImageDescriberState>(INITIAL_STATE)
  const [model, setModel] = useState(DESCRIBER_MODELS[0].id)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const abortRef = useRef(false)
  // Counter to trigger regeneration
  const genTrigger = useRef(0)
  const [genCount, setGenCount] = useState(0)

  const selectImage = useCallback((image: SelectedImage) => {
    setState({
      status: 'describing',
      sourceImage: image,
      sourceFile: null,
      description: null,
      generatedImageUrl: null,
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
      generatedImageUrl: null,
      error: null,
    })
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    setState(INITIAL_STATE)
    setIsSaving(false)
    setIsSaved(false)
  }, [])

  const saveImage = useCallback(async () => {
    const accessToken = session?.access_token
    if (
      state.status !== 'complete' ||
      !state.generatedImageUrl ||
      !state.description ||
      !accessToken ||
      isSaving ||
      isSaved
    )
      return

    setIsSaving(true)
    try {
      await saveGeneratedImage({
        data: {
          accessToken,
          imageUrl: state.generatedImageUrl,
          prompt: state.description,
          model,
          aspectRatio,
        },
      })
      setIsSaved(true)
    } catch (err) {
      console.error('Failed to save generated image:', err)
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to save image',
      }))
    } finally {
      setIsSaving(false)
    }
  }, [
    state.status,
    state.generatedImageUrl,
    state.description,
    session?.access_token,
    isSaving,
    isSaved,
    model,
    aspectRatio,
  ])

  const regenerateDescription = useCallback(() => {
    if (!state.sourceImage) return
    abortRef.current = true
    setState((s) => ({
      ...s,
      status: 'describing',
      description: null,
      error: null,
    }))
  }, [state.sourceImage])

  const regenerateImage = useCallback(() => {
    if (!state.description) return
    abortRef.current = true
    setState((s) => ({
      ...s,
      status: 'generating',
      generatedImageUrl: null,
      error: null,
    }))
    genTrigger.current += 1
    setGenCount(genTrigger.current)
  }, [state.description])

  // Auto-describe when sourceImage is set
  useEffect(() => {
    if (state.status !== 'describing' || !state.sourceImage) return

    const accessToken = session?.access_token
    if (!accessToken) return

    abortRef.current = false

    void (async () => {
      try {
        // If source came from a file, read as data URL instead of using the object URL
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
  }, [state.status, state.sourceImage, state.sourceFile, session?.access_token])

  // Auto-generate when description is received (or regenerate triggered)
  useEffect(() => {
    if (state.status !== 'generating' || !state.description) return

    const accessToken = session?.access_token
    if (!accessToken) return

    abortRef.current = false

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
        setIsSaved(false)
        setState((s) => ({
          ...s,
          status: 'complete',
          generatedImageUrl: result.imageUrl,
        }))
      } catch (err) {
        if (abortRef.current) return
        setState((s) => ({
          ...s,
          status: 'error',
          error:
            err instanceof Error ? err.message : 'Failed to generate image',
        }))
      }
    })()
    // genCount included to re-trigger on regenerate
  }, [
    state.status,
    state.description,
    session?.access_token,
    model,
    aspectRatio,
    genCount,
  ])

  return {
    status: state.status,
    sourceImage: state.sourceImage,
    description: state.description,
    generatedImageUrl: state.generatedImageUrl,
    error: state.error,
    model,
    orientation,
    aspectRatio,
    setOrientation,
    isSaving,
    isSaved,
    selectImage,
    selectFile,
    setModel,
    setAspectRatio,
    regenerateDescription,
    regenerateImage,
    reset,
    saveImage,
  }
}
