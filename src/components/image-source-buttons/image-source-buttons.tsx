import { LibraryPickerButton } from '../library-picker-button/library-picker-button'
import { FileUploadButton } from '../file-upload-button/file-upload-button'
import { ClipboardPasteButton } from '../clipboard-paste-button/clipboard-paste-button'
import styles from './image-source-buttons.module.css'
import type { SelectedImage } from '../library-picker-button/library-picker-button'

interface UserImageRow {
  id: string
  title: string
  source: string
  storage_path: string | null
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
          className={styles.button}
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
        className={styles.button}
      />
      {showPaste && (
        <ClipboardPasteButton
          onImagePasted={onFileSelected}
          className={styles.button}
        />
      )}
    </div>
  )
}
