import { FrameImageArea } from './FrameImageArea'
import { LibraryPickerButton } from '@/components/LibraryPickerButton'
import { FileUploadButton } from '@/components/FileUploadButton'
import { ClipboardPasteButton } from '@/components/ClipboardPasteButton'

interface UserImagesData {
  images: Array<{
    id: string
    title: string
    source: string
    storage_path: string
    [key: string]: unknown
  }>
  imageUrls: Record<string, string>
  isLoading: boolean
}

interface FirstFramePanelProps {
  type: 'first'
  status: 'idle' | 'generating' | 'completed' | 'error'
  url: string | null
  error: string | null
  onFileSelected: (file: File) => void
  onImageFromUrl: (url: string, name: string) => void
  userImages: UserImagesData
}

interface LastFramePanelProps {
  type: 'last'
  status: 'idle' | 'generating' | 'completed' | 'error'
  url: string | null
  error: string | null
  onFileSelected: (file: File) => void
  onImageFromUrl: (url: string, name: string) => void
  userImages: UserImagesData
}

type FramePanelProps = FirstFramePanelProps | LastFramePanelProps

export function FramePanel(props: FramePanelProps) {
  if (props.type === 'first') {
    return <FirstFramePanel {...props} />
  }
  return <LastFramePanel {...props} />
}

function FirstFramePanel({
  status,
  url,
  error,
  onFileSelected,
  onImageFromUrl,
  userImages,
}: FirstFramePanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">First Frame</h2>
        <div className="flex gap-1">
          <LibraryPickerButton
            images={userImages.images}
            imageUrls={userImages.imageUrls}
            isLoading={userImages.isLoading}
            onSelect={(img) => onImageFromUrl(img.url, img.title)}
            className="size-7"
          />
          <FileUploadButton
            onFilesSelected={(files) => {
              if (files[0]) onFileSelected(files[0])
            }}
            multiple={false}
            className="size-7"
          />
          <ClipboardPasteButton
            onImagePasted={onFileSelected}
            className="size-7"
          />
        </div>
      </div>

      <FrameImageArea
        status={status}
        imageUrl={url}
        placeholder="First frame will appear here"
        generatingLabel="Uploading..."
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function LastFramePanel({
  status,
  url,
  error,
  onFileSelected,
  onImageFromUrl,
  userImages,
}: LastFramePanelProps) {
  return (
    <div className="space-y-3 transition-opacity">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Last Frame (Optional)</h2>
        <div className="flex gap-1">
          <LibraryPickerButton
            images={userImages.images}
            imageUrls={userImages.imageUrls}
            isLoading={userImages.isLoading}
            onSelect={(img) => onImageFromUrl(img.url, img.title)}
            className="size-7"
          />
          <FileUploadButton
            onFilesSelected={(files) => {
              if (files[0]) onFileSelected(files[0])
            }}
            multiple={false}
            className="size-7"
          />
          <ClipboardPasteButton
            onImagePasted={onFileSelected}
            className="size-7"
          />
        </div>
      </div>

      <FrameImageArea
        status={status}
        imageUrl={url}
        placeholder="Optional - add a last frame for transitions"
        generatingLabel="Uploading..."
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
