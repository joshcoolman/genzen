import { useCallback, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { LibraryPickerDialog } from './LibraryPickerDialog'
import { Button } from '@/components/ui/button'

export interface SelectedImage {
  id: string
  url: string
  title: string
}

interface UserImageRow {
  id: string
  title: string
  source: string
  storage_path: string
  [key: string]: unknown
}

interface LibraryPickerButtonProps {
  images: Array<UserImageRow>
  imageUrls: Record<string, string>
  isLoading: boolean
  onSelect: (image: SelectedImage) => void
  onSelectMultiple?: (images: Array<SelectedImage>) => void
  multiple?: boolean
  onOpen?: () => void
  className?: string
}

export function LibraryPickerButton({
  images,
  imageUrls,
  isLoading,
  onSelect,
  onSelectMultiple,
  multiple = false,
  onOpen,
  className,
}: LibraryPickerButtonProps) {
  const [open, setOpen] = useState(false)

  const handleOpen = useCallback(() => {
    onOpen?.()
    setOpen(true)
  }, [onOpen])

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={className}
        onClick={handleOpen}
      >
        <BookOpen />
      </Button>

      <LibraryPickerDialog
        open={open}
        onOpenChange={setOpen}
        images={images}
        imageUrls={imageUrls}
        isLoading={isLoading}
        onSelect={onSelect}
        onSelectMultiple={onSelectMultiple}
        multiple={multiple}
      />
    </>
  )
}
