import { Library } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { FileUploadButton } from '@/components/FileUploadButton'
import { ClipboardPasteButton } from '@/components/ClipboardPasteButton'

interface CollectionToolbarProps {
  onFilesSelected: (files: Array<File>) => void
  onImagePasted: (file: File) => void
  onOpenPicker: () => void
  isUploading: boolean
  collectionCount: number
}

export function CollectionToolbar({
  onFilesSelected,
  onImagePasted,
  onOpenPicker,
  isUploading,
  collectionCount,
}: CollectionToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <FileUploadButton onFilesSelected={onFilesSelected} />

      <ClipboardPasteButton onImagePasted={onImagePasted} />

      <ActionButton
        onClick={onOpenPicker}
        icon={<Library />}
        loading={isUploading}
        loadingText="Uploading..."
        className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
      >
        Select from Library
      </ActionButton>

      {collectionCount > 0 && (
        <span className="ml-auto text-sm text-muted-foreground">
          {collectionCount} {collectionCount === 1 ? 'image' : 'images'}{' '}
          collected
        </span>
      )}
    </div>
  )
}
