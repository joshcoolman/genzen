import { FrameImageArea } from './FrameImageArea'
import type { FrameMode, FrameStatus, LastFrameMode } from '../types'
import { ActionButton } from '@/components/ActionButton'
import { Textarea } from '@/components/ui/textarea'
import { LibraryPickerButton } from '@/components/LibraryPickerButton'
import { FileUploadButton } from '@/components/FileUploadButton'
import { ClipboardPasteButton } from '@/components/ClipboardPasteButton'
import { PromptButton } from '@/components/PromptButton'

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
  mode: FrameMode
  status: FrameStatus
  url: string | null
  error: string | null
  prompt: string
  onPromptChange: (value: string) => void
  suggesting?: boolean
  onActivatePrompt: () => void
  onFileSelected: (file: File) => void
  onImageFromUrl: (url: string, name: string) => void
  onGenerate: () => void
  userImages: UserImagesData
}

interface LastFramePanelProps {
  type: 'last'
  mode: LastFrameMode
  status: FrameStatus
  url: string | null
  error: string | null
  prompt: string
  onPromptChange: (value: string) => void
  suggesting: boolean
  onActivatePrompt: () => void
  onFileSelected: (file: File) => void
  onImageFromUrl: (url: string, name: string) => void
  onGenerate: () => void
  generateDisabled: boolean
  includeFirstFrame: boolean
  onIncludeFirstFrameChange: (value: boolean) => void
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
  mode,
  status,
  url,
  error,
  prompt,
  onPromptChange,
  suggesting,
  onActivatePrompt,
  onFileSelected,
  onImageFromUrl,
  userImages,
  onGenerate,
}: FirstFramePanelProps) {
  const isPromptMode = mode === 'prompt'
  const showPromptArea = isPromptMode && status === 'idle'
  const buttonsDisabled = status === 'generating'

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
          <PromptButton
            onPrompt={onActivatePrompt}
            loading={suggesting}
            disabled={buttonsDisabled}
            className="size-7"
          />
        </div>
      </div>

      {showPromptArea ? (
        <div className="relative aspect-video rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
          <Textarea
            placeholder="Describe the opening scene..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="h-full w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={6}
          />
        </div>
      ) : (
        <FrameImageArea
          status={status}
          imageUrl={url}
          placeholder="First frame will appear here"
          generatingLabel={isPromptMode ? 'Generating...' : 'Uploading...'}
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {isPromptMode && (
        <ActionButton
          onClick={onGenerate}
          disabled={status === 'generating' || !prompt.trim()}
          className="w-full"
        >
          {status === 'generating'
            ? 'Generating...'
            : status === 'completed'
              ? 'Regenerate First Frame'
              : 'Generate First Frame'}
        </ActionButton>
      )}
    </div>
  )
}

function LastFramePanel({
  mode,
  status,
  url,
  error,
  prompt,
  onPromptChange,
  suggesting,
  onActivatePrompt,
  onFileSelected,
  onImageFromUrl,
  userImages,
  onGenerate,
  generateDisabled,
  includeFirstFrame,
  onIncludeFirstFrameChange,
}: LastFramePanelProps) {
  const isPromptMode = mode === 'prompt'
  const showPromptArea = isPromptMode && status === 'idle'
  const buttonsDisabled = status === 'generating'

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
          <PromptButton
            onPrompt={onActivatePrompt}
            loading={suggesting}
            disabled={buttonsDisabled}
            className="size-7"
          />
        </div>
      </div>

      {showPromptArea ? (
        <div className="relative aspect-video rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
          <Textarea
            placeholder="Describe what changes in the scene..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="h-full w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={6}
          />
        </div>
      ) : (
        <FrameImageArea
          status={status}
          imageUrl={url}
          placeholder="Optional - add a last frame for transitions"
          generatingLabel="Generating..."
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <ActionButton
        onClick={onGenerate}
        disabled={generateDisabled}
        className="w-full"
      >
        {status === 'generating'
          ? 'Generating...'
          : mode === 'image' && url
            ? 'Generate Video'
            : status === 'completed'
              ? 'Regenerate Last Frame'
              : 'Generate Last Frame'}
      </ActionButton>

      {isPromptMode && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeFirstFrame}
            onChange={(e) => onIncludeFirstFrameChange(e.target.checked)}
            disabled={status === 'generating'}
            className="accent-accent-brand"
          />
          <span className="text-xs text-muted-foreground">
            Use first frame as reference
          </span>
        </label>
      )}
    </div>
  )
}
