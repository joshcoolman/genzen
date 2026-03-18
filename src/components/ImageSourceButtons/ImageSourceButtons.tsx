import type { SelectedImage } from '@/components/LibraryPickerButton'
import { LibraryPickerButton } from '@/components/LibraryPickerButton'
import { FileUploadButton } from '@/components/FileUploadButton'
import { ClipboardPasteButton } from '@/components/ClipboardPasteButton'

interface UserImageRow {
  id: string
  title: string
  source: string
  storage_path: string
  [key: string]: unknown
}

interface ImageSourceButtonsProps {
  onFileSelected: (file: File) => void
  library?: {
    images: Array<UserImageRow>
    imageUrls: Record<string, string>
    isLoading: boolean
    onSelect: (image: SelectedImage) => void
    onSelectMultiple?: (images: Array<SelectedImage>) => void
    onOpen?: () => void
  }
  multiple?: boolean
  showPaste?: boolean
  className?: string
}

export function ImageSourceButtons({
  onFileSelected,
  library,
  multiple,
  showPaste = true,
  className,
}: ImageSourceButtonsProps) {
  return (
    <div className={className}>
      {library && (
        <LibraryPickerButton
          images={library.images}
          imageUrls={library.imageUrls}
          isLoading={library.isLoading}
          onSelect={library.onSelect}
          onSelectMultiple={library.onSelectMultiple}
          multiple={multiple}
          onOpen={library.onOpen}
          className="shrink-0"
        />
      )}
      <FileUploadButton
        onFilesSelected={(files) => {
          if (multiple) {
            files.forEach((f) => onFileSelected(f))
          } else if (files[0]) {
            onFileSelected(files[0])
          }
        }}
        multiple={multiple}
        className="shrink-0"
      />
      {showPaste && (
        <ClipboardPasteButton
          onImagePasted={onFileSelected}
          className="shrink-0"
        />
      )}
    </div>
  )
}
