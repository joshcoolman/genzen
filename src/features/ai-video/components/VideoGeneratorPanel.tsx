import { useState } from 'react'
import { getVideoModel } from '../video-models'
import { FrameImageArea } from './FrameImageArea'
import type { FrameStatus, VideoSettings } from '../types'
import type { useModelSelector } from '@/components/ModelSelector'
import { ModelSelector } from '@/components/ModelSelector'
import { ImageSourceDialog } from '@/components/ImageSourceDialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useQuickOutpaint } from '@/features/outpaint/hooks/useQuickOutpaint'
import { QuickOutpaintDialog } from '@/features/outpaint/components/QuickOutpaintDialog'
import { cn } from '@/lib/utils'

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

interface VideoGeneratorPanelProps {
  // Model selector (shared component)
  modelSelector: ReturnType<typeof useModelSelector>
  // First frame
  firstFrameStatus: FrameStatus
  firstFrameUrl: string | null
  firstFrameError: string | null
  onFirstFrameImageFromUrl: (url: string, name: string) => void
  // Last frame
  lastFrameStatus: FrameStatus
  lastFrameUrl: string | null
  lastFrameError: string | null
  onLastFrameImageFromUrl: (url: string, name: string) => void
  // Video settings
  settings: VideoSettings
  onSettingsChange: (settings: VideoSettings) => void
  onGenerate: () => void
  generating: boolean
  // User images for library picker
  userImages: UserImagesData
  // Reset
  onReset?: () => void
  showReset?: boolean
  // Upload to library (used by ImageSourceDialog)
  onUploadToLibrary?: (file: File) => Promise<void>
  // Credits
  creditBalance?: number | null
}

export function VideoGeneratorPanel({
  modelSelector,
  firstFrameStatus,
  firstFrameUrl,
  firstFrameError,
  onFirstFrameImageFromUrl,
  lastFrameStatus,
  lastFrameUrl,
  lastFrameError,
  onLastFrameImageFromUrl,
  settings,
  onSettingsChange,
  onGenerate,
  generating,
  userImages,
  onUploadToLibrary,
  onReset,
  showReset,
  creditBalance,
}: VideoGeneratorPanelProps) {
  const selectedModel = getVideoModel(settings.videoModel)
  const durations = selectedModel?.durations ?? ['5', '10']

  const firstFrameReady = firstFrameStatus === 'completed'
  const disabled = firstFrameStatus !== 'completed' || generating

  const [firstFrameDialogOpen, setFirstFrameDialogOpen] = useState(false)
  const [lastFrameDialogOpen, setLastFrameDialogOpen] = useState(false)

  const firstOutpaint = useQuickOutpaint({
    sourceImageUrl: firstFrameStatus === 'completed' ? firstFrameUrl : null,
    expectedAspectRatio: '16:9',
  })

  const lastOutpaint = useQuickOutpaint({
    sourceImageUrl: lastFrameStatus === 'completed' ? lastFrameUrl : null,
    expectedAspectRatio: '16:9',
  })

  function handleFirstFrameResult(result: { url: string; title: string }) {
    onFirstFrameImageFromUrl(result.url, result.title)
  }

  function handleLastFrameResult(result: { url: string; title: string }) {
    onLastFrameImageFromUrl(result.url, result.title)
  }

  return (
    <div className="space-y-4">
      {/* Model selector — shared dropdown component */}
      <ModelSelector
        display="dropdown"
        mode="single"
        persistKey="genzen:video-model-panel:expanded"
        selectedIds={modelSelector.selectedIds}
        visibleModels={modelSelector.models}
        onToggleSelected={modelSelector.toggleSelected}
      />

      {selectedModel && !selectedModel.supportsFlf && (
        <p className="text-xs text-muted-foreground">
          This model supports first frame only
        </p>
      )}

      {/* First Frame */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">First Frame</label>
        <FrameImageArea
          status={firstFrameStatus}
          imageUrl={firstFrameUrl}
          placeholder="Click to choose first frame"
          generatingLabel="Uploading..."
          onChooseImage={() => setFirstFrameDialogOpen(true)}
        />
        {firstOutpaint.needsOutpaint && (
          <Button
            size="sm"
            variant="outline"
            onClick={firstOutpaint.openDialog}
          >
            Outpaint to 16:9
          </Button>
        )}
        <QuickOutpaintDialog {...firstOutpaint.dialogProps} />
        {firstFrameError && (
          <p className="text-xs text-destructive">{firstFrameError}</p>
        )}
      </div>

      {/* Last Frame */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          Last Frame (Optional)
        </label>
        <FrameImageArea
          status={lastFrameStatus}
          imageUrl={lastFrameUrl}
          placeholder="Click to choose last frame"
          generatingLabel="Uploading..."
          onChooseImage={() => setLastFrameDialogOpen(true)}
        />
        {lastOutpaint.needsOutpaint && (
          <Button size="sm" variant="outline" onClick={lastOutpaint.openDialog}>
            Outpaint to 16:9
          </Button>
        )}
        <QuickOutpaintDialog {...lastOutpaint.dialogProps} />
        {lastFrameError && (
          <p className="text-xs text-destructive">{lastFrameError}</p>
        )}
      </div>

      {showReset && (
        <button
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          + Start new generation
        </button>
      )}

      {/* Transition Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          Transition Prompt
        </label>
        <Textarea
          placeholder="Describe how the scene transitions between frames..."
          value={settings.prompt}
          onChange={(e) =>
            onSettingsChange({ ...settings, prompt: e.target.value })
          }
          disabled={generating}
          rows={3}
        />
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Duration</label>
        <div className="flex gap-1">
          {durations.map((d) => (
            <button
              key={d}
              onClick={() => onSettingsChange({ ...settings, duration: d })}
              disabled={generating}
              className={cn(
                'px-3 py-1.5 text-xs rounded border transition-colors',
                settings.duration === d
                  ? 'border-accent-brand bg-accent-brand/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {/* CFG Scale */}
      {selectedModel?.supportsCfgScale !== false && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            CFG Scale ({settings.cfgScale.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.cfgScale}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                cfgScale: parseFloat(e.target.value),
              })
            }
            disabled={generating}
            className="w-full accent-accent-brand"
          />
        </div>
      )}

      {/* Negative Prompt */}
      {selectedModel?.supportsNegativePrompt !== false && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Negative Prompt
          </label>
          <Textarea
            placeholder="Things to avoid in the video..."
            value={settings.negativePrompt}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                negativePrompt: e.target.value,
              })
            }
            disabled={generating}
            rows={2}
          />
        </div>
      )}

      {/* Generate button */}
      {!firstFrameReady && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Add a first frame to enable video generation
        </p>
      )}

      <Button onClick={onGenerate} disabled={disabled} className="w-full">
        {generating ? 'Generating Video...' : 'Generate Video'}
      </Button>

      {creditBalance !== null && creditBalance !== undefined && (
        <p className="text-center text-xs text-muted-foreground">
          {creditBalance} credits
        </p>
      )}

      {/* Image source dialogs */}
      <ImageSourceDialog
        open={firstFrameDialogOpen}
        onOpenChange={setFirstFrameDialogOpen}
        title="First Frame"
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        originalUrls={userImages.originalUrls}
        isLoading={userImages.isLoading}
        onSelect={handleFirstFrameResult}
        onUploadToLibrary={onUploadToLibrary}
      />

      <ImageSourceDialog
        open={lastFrameDialogOpen}
        onOpenChange={setLastFrameDialogOpen}
        title="Last Frame"
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        originalUrls={userImages.originalUrls}
        isLoading={userImages.isLoading}
        onSelect={handleLastFrameResult}
        onUploadToLibrary={onUploadToLibrary}
      />
    </div>
  )
}
