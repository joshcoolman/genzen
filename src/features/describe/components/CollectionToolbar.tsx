import { useRef } from 'react'
import { ImagePlus, Library, Upload } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'

interface CollectionToolbarProps {
  onFilesSelected: (files: FileList) => void
  onOpenPicker: () => void
  isUploading: boolean
  collectionCount: number
}

export function CollectionToolbar({
  onFilesSelected,
  onOpenPicker,
  isUploading,
  collectionCount,
}: CollectionToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files)
            e.target.value = ''
          }
        }}
      />

      <ActionButton
        onClick={() => fileInputRef.current?.click()}
        icon={<Upload />}
        loading={isUploading}
        loadingText="Uploading..."
      >
        Upload
      </ActionButton>

      <ActionButton
        onClick={onOpenPicker}
        icon={<Library />}
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

      <span className="text-xs text-muted-foreground">
        <ImagePlus className="mr-1 inline size-3" />
        Paste to add
      </span>
    </div>
  )
}
