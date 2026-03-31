import { FrameImageArea } from './FrameImageArea'
import { LibraryPickerButton } from '@/components/LibraryPickerButton'
import { FileUploadButton } from '@/components/FileUploadButton'
import { ClipboardPasteButton } from '@/components/ClipboardPasteButton'
import { Button } from '@/components/ui/button'
import { useQuickOutpaint } from '@/features/outpaint/hooks/useQuickOutpaint'
import { QuickOutpaintDialog } from '@/features/outpaint/components/QuickOutpaintDialog'

interface UserImagesData {
  images: Array<{
    id: string
    title: string
    source: string
    storage_path: string | null
    [key: string]: unknown
  }>
  imageUrls: Record<string, string>
  originalUrls?: Record<string, string>
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
  const outpaint = useQuickOutpaint({
    sourceImageUrl: status === 'completed' ? url : null,
    expectedAspectRatio: '16:9',
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">First Frame</h2>
        <div className="flex gap-1">
          <LibraryPickerButton
            images={userImages.images}
            imageUrls={userImages.imageUrls}
            originalUrls={userImages.originalUrls}
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

      {outpaint.needsOutpaint && (
        <Button size="sm" variant="outline" onClick={outpaint.openDialog}>
          Outpaint to 16:9
        </Button>
      )}

      <QuickOutpaintDialog {...outpaint.dialogProps} />

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
  const outpaint = useQuickOutpaint({
    sourceImageUrl: status === 'completed' ? url : null,
    expectedAspectRatio: '16:9',
  })

  return (
    <div className="space-y-3 transition-opacity">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Last Frame (Optional)</h2>
        <div className="flex gap-1">
          <LibraryPickerButton
            images={userImages.images}
            imageUrls={userImages.imageUrls}
            originalUrls={userImages.originalUrls}
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

      {outpaint.needsOutpaint && (
        <Button size="sm" variant="outline" onClick={outpaint.openDialog}>
          Outpaint to 16:9
        </Button>
      )}

      <QuickOutpaintDialog {...outpaint.dialogProps} />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
