import { useExistingImages } from './useExistingImages'
import { useImageDescriber } from './useImageDescriber'
import type { UseImageDescriberReturn } from './useImageDescriber'
import { useAuth } from '@/lib/auth'

export interface UseDescribePageReturn {
  existingImages: ReturnType<typeof useExistingImages>
  describer: UseImageDescriberReturn
}

export function useDescribePage(): UseDescribePageReturn {
  const { user } = useAuth()
  const existingImages = useExistingImages(user?.id)
  const describer = useImageDescriber()

  return {
    existingImages,
    describer,
  }
}
