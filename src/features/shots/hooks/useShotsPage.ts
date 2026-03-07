import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SelectedImage } from '@/components/LibraryPickerButton'
import { useAuth } from '@/lib/auth'
import { useExistingImages } from '@/features/describe/hooks/useExistingImages'

export type ShotsStep = 'upload' | 'select' | 'upscale'

export interface MockShot {
  id: string
  gradient: string
}

const GRADIENTS = [
  'from-rose-500 to-orange-400',
  'from-violet-500 to-purple-400',
  'from-blue-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-yellow-400',
  'from-pink-500 to-fuchsia-400',
  'from-sky-500 to-indigo-400',
  'from-lime-500 to-green-400',
  'from-red-500 to-rose-400',
]

function generateMockShots(): Array<MockShot> {
  return GRADIENTS.map((gradient, i) => ({
    id: `shot-${i + 1}`,
    gradient,
  }))
}

export interface UseShotsPageReturn {
  step: ShotsStep
  sourceImageUrl: string | null
  shots: Array<MockShot>
  selectedIds: Set<string>
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  needsOutpaint: boolean
  existingImages: ReturnType<typeof useExistingImages>
  setSourceImage: (file: File) => void
  selectLibraryImage: (image: SelectedImage) => void
  setOrientation: (o: 'landscape' | 'portrait') => void
  setAspectRatio: (r: string) => void
  generateShots: () => void
  toggleSelection: (id: string) => void
  upscaleSelected: () => void
  reset: () => void
}

export function useShotsPage(): UseShotsPageReturn {
  const { user } = useAuth()
  const existingImages = useExistingImages(user?.id)

  const [step, setStep] = useState<ShotsStep>('upload')
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null)
  const [shots, setShots] = useState<Array<MockShot>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [naturalDims, setNaturalDims] = useState<{
    w: number
    h: number
  } | null>(null)

  useEffect(() => {
    if (!sourceImageUrl) {
      setNaturalDims(null)
      return
    }
    const img = new Image()
    img.onload = () =>
      setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = sourceImageUrl
  }, [sourceImageUrl])

  const needsOutpaint = useMemo(() => {
    if (!naturalDims || !sourceImageUrl) return false
    const [tw, th] = aspectRatio.split(':').map(Number)
    if (!tw || !th) return false
    const targetRatio = tw / th
    const imageRatio = naturalDims.w / naturalDims.h
    const TOLERANCE = 0.05
    return Math.abs(targetRatio - imageRatio) > TOLERANCE
  }, [naturalDims, sourceImageUrl, aspectRatio])

  const setSourceImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    setSourceImageUrl(url)
  }, [])

  const selectLibraryImage = useCallback(
    (image: SelectedImage) => {
      const url = existingImages.imageUrls[image.id]
      if (url) setSourceImageUrl(url)
    },
    [existingImages.imageUrls],
  )

  const generateShots = useCallback(() => {
    setShots(generateMockShots())
    setSelectedIds(new Set())
    setStep('select')
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const upscaleSelected = useCallback(() => {
    setStep('upscale')
  }, [])

  const reset = useCallback(() => {
    setStep('upload')
    setSourceImageUrl(null)
    setShots([])
    setSelectedIds(new Set())
  }, [])

  return useMemo(
    () => ({
      step,
      sourceImageUrl,
      shots,
      selectedIds,
      orientation,
      aspectRatio,
      needsOutpaint,
      existingImages,
      setSourceImage,
      selectLibraryImage,
      setOrientation,
      setAspectRatio,
      generateShots,
      toggleSelection,
      upscaleSelected,
      reset,
    }),
    [
      step,
      sourceImageUrl,
      shots,
      selectedIds,
      orientation,
      aspectRatio,
      needsOutpaint,
      existingImages,
      setSourceImage,
      selectLibraryImage,
      generateShots,
      toggleSelection,
      upscaleSelected,
      reset,
    ],
  )
}
