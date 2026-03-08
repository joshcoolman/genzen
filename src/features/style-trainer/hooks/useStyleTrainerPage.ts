import { useCallback, useMemo, useState } from 'react'
import type { SelectedImage } from '@/components/LibraryPickerButton'
import { useAuth } from '@/lib/auth'
import { useExistingImages } from '@/features/describe/hooks/useExistingImages'

export type StyleTrainerStep =
  | 'collect'
  | 'configure'
  | 'training'
  | 'test'
  | 'library'

export interface ReferenceImage {
  id: string
  url: string
}

export interface MockTestResult {
  id: string
  url: string
}

export interface SavedStyle {
  id: string
  name: string
  thumbnailUrl: string | null
  imageCount: number
}

export interface UseStyleTrainerPageReturn {
  step: StyleTrainerStep
  styleName: string
  referenceImages: Array<ReferenceImage>
  trainingProgress: number
  testPrompt: string
  testResults: Array<MockTestResult>
  savedStyles: Array<SavedStyle>
  existingImages: ReturnType<typeof useExistingImages>
  addFile: (file: File) => void
  selectLibraryImage: (image: SelectedImage) => void
  selectLibraryImages: (images: Array<SelectedImage>) => void
  removeImage: (id: string) => void
  goToConfigure: () => void
  setStyleName: (name: string) => void
  startTraining: () => void
  goToTest: () => void
  setTestPrompt: (prompt: string) => void
  runTest: () => void
  saveStyle: () => void
  goToLibrary: () => void
  reset: () => void
}

export function useStyleTrainerPage(): UseStyleTrainerPageReturn {
  const { user } = useAuth()
  const existingImages = useExistingImages(user?.id)

  const [step, setStep] = useState<StyleTrainerStep>('collect')
  const [styleName, setStyleName] = useState('')
  const [referenceImages, setReferenceImages] = useState<Array<ReferenceImage>>(
    [],
  )
  const [trainingProgress] = useState(100)
  const [testPrompt, setTestPrompt] = useState('')
  const [testResults, setTestResults] = useState<Array<MockTestResult>>([])
  const [savedStyles, setSavedStyles] = useState<Array<SavedStyle>>([])

  const addFile = useCallback((file: File) => {
    setReferenceImages((prev) => {
      if (prev.length >= 20) return prev
      const url = URL.createObjectURL(file)
      return [...prev, { id: `ref-${Date.now()}-${Math.random()}`, url }]
    })
  }, [])

  const selectLibraryImage = useCallback((image: SelectedImage) => {
    setReferenceImages((prev) => {
      if (prev.length >= 20) return prev
      if (prev.some((img) => img.id === `lib-${image.id}`)) return prev
      return [...prev, { id: `lib-${image.id}`, url: image.url }]
    })
  }, [])

  const selectLibraryImages = useCallback(
    (images: Array<SelectedImage>) => {
      const newImages = images
        .filter(
          (img) => !referenceImages.some((ref) => ref.id === `lib-${img.id}`),
        )
        .map((img) => ({ id: `lib-${img.id}`, url: img.url }))
      if (newImages.length > 0) {
        setReferenceImages((prev) => {
          const remaining = 20 - prev.length
          return [...prev, ...newImages.slice(0, remaining)]
        })
      }
    },
    [referenceImages],
  )

  const removeImage = useCallback((id: string) => {
    setReferenceImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const goToConfigure = useCallback(() => {
    setStep('configure')
  }, [])

  const startTraining = useCallback(() => {
    setStep('training')
  }, [])

  const goToTest = useCallback(() => {
    setStep('test')
  }, [])

  const runTest = useCallback(() => {
    // Mock: reuse the first few reference images as "results"
    setTestResults(
      referenceImages.slice(0, 4).map((img, i) => ({
        id: `result-${i + 1}`,
        url: img.url,
      })),
    )
  }, [referenceImages])

  const saveStyle = useCallback(() => {
    const newStyle: SavedStyle = {
      id: `style-${Date.now()}`,
      name: styleName || 'Untitled Style',
      thumbnailUrl: referenceImages[0]?.url ?? null,
      imageCount: referenceImages.length,
    }
    setSavedStyles((prev) => [...prev, newStyle])
    setStep('library')
  }, [styleName, referenceImages])

  const goToLibrary = useCallback(() => {
    setStep('library')
  }, [])

  const reset = useCallback(() => {
    setStep('collect')
    setStyleName('')
    setReferenceImages([])
    setTestPrompt('')
    setTestResults([])
  }, [])

  return useMemo(
    () => ({
      step,
      styleName,
      referenceImages,
      trainingProgress,
      testPrompt,
      testResults,
      savedStyles,
      existingImages,
      addFile,
      selectLibraryImage,
      selectLibraryImages,
      removeImage,
      goToConfigure,
      setStyleName,
      startTraining,
      goToTest,
      setTestPrompt,
      runTest,
      saveStyle,
      goToLibrary,
      reset,
    }),
    [
      step,
      styleName,
      referenceImages,
      trainingProgress,
      testPrompt,
      testResults,
      savedStyles,
      existingImages,
      addFile,
      selectLibraryImage,
      selectLibraryImages,
      removeImage,
      goToConfigure,
      startTraining,
      goToTest,
      runTest,
      saveStyle,
      goToLibrary,
      reset,
    ],
  )
}
