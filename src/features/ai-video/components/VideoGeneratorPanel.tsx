import { useState } from 'react'
import { Plus } from 'lucide-react'
import { getVideoModel } from '../video-models'
import { FrameImageArea } from './FrameImageArea'
import type { FrameStatus } from '../types'
import type { UseVideoSidebarReturn } from '../hooks/use-video-sidebar'
import type { UserImage } from '@/features/user-images/types'
import { ModelSelector, useModelSelector } from '@/components/ModelSelector'
import { ImageSourceDialog } from '@/components/ImageSourceDialog'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { RefImageStrip } from '@/components/RefImageStrip'
import { ShotCard } from '@/features/multi-shot/components/ShotCard'
import { cn } from '@/lib/utils'

interface VideoGeneratorPanelProps {
  sidebar: UseVideoSidebarReturn
  userImages: {
    images: Array<UserImage>
    imageUrls: Record<string, string>
    originalUrls: Record<string, string>
    isLoading: boolean
  }
  onUploadToLibrary?: (file: File) => Promise<void>
  creditBalance?: number | null
}

export function VideoGeneratorPanel({
  sidebar,
  userImages,
  onUploadToLibrary,
  creditBalance,
}: VideoGeneratorPanelProps) {
  const isFlf = sidebar.mode === 'flf'
  const isMulti = sidebar.mode === 'multishot'

  const modelSelector = useModelSelector({
    capability: 'video',
    mode: 'single',
  })

  // In FLF mode, the sidebar's videoModel is the source of truth. Edit view
  // rehydrates it from the selected video's snapshot via loadFromVideo(), so
  // we can't let the locally-persisted model selector overwrite it. Drive the
  // selector directly from sidebar state, and forward user clicks back to
  // setVideoModel.
  const flfSelectedIds = isFlf
    ? [sidebar.videoModel]
    : modelSelector.selectedIds
  const handleToggleFlfModel = (id: string) => sidebar.setVideoModel(id)

  const selectedModel = getVideoModel(sidebar.videoModel)
  const durations = selectedModel?.durations ?? ['5', '10']

  const [firstFrameDialogOpen, setFirstFrameDialogOpen] = useState(false)
  const [lastFrameDialogOpen, setLastFrameDialogOpen] = useState(false)
  const [elementPickerOpen, setElementPickerOpen] = useState(false)

  const frameStatus: FrameStatus = sidebar.firstFrameUrl ? 'completed' : 'idle'
  const lastFrameStatus: FrameStatus = sidebar.lastFrameUrl
    ? 'completed'
    : 'idle'

  // Never gate the button on an in-flight submit -- rapid-fire should always
  // be allowed. Only disable when the form itself isn't ready.
  const disabled = isFlf ? !sidebar.firstFrameRecordId : !sidebar.firstFrameUrl

  const generateLabel = isFlf ? 'Generate Video' : 'Generate Multi-Shot'

  return (
    <div className="space-y-4">
      {/* Mode toggle -- pill style */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => sidebar.setMode('flf')}
          className={cn(
            'flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
            isFlf
              ? 'bg-accent-brand text-white'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          First/Last Frame
        </button>
        <button
          type="button"
          onClick={() => sidebar.setMode('multishot')}
          className={cn(
            'flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
            isMulti
              ? 'bg-accent-brand text-white'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Multi-Shot
        </button>
      </div>

      {/* Model selector -- FLF only */}
      {isFlf && (
        <ModelSelector
          display="dropdown"
          mode="single"
          persistKey="genzen:video-model-panel:expanded"
          selectedIds={flfSelectedIds}
          visibleModels={modelSelector.models}
          onToggleSelected={handleToggleFlfModel}
        />
      )}

      {/* First frame / Start image -- both modes (shared slot) */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          {isMulti ? 'Start Image' : 'First Frame'}
        </label>
        <FrameImageArea
          status={frameStatus}
          imageUrl={sidebar.firstFrameUrl}
          placeholder={
            isMulti
              ? 'Click to choose start image'
              : 'Click to choose first frame'
          }
          onChooseImage={() => setFirstFrameDialogOpen(true)}
        />
      </div>

      {/* Last frame -- FLF only */}
      {isFlf && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Last Frame (Optional)
          </label>
          <FrameImageArea
            status={lastFrameStatus}
            imageUrl={sidebar.lastFrameUrl}
            placeholder="Click to choose last frame"
            onChooseImage={() => setLastFrameDialogOpen(true)}
          />
        </div>
      )}

      {/* Elements -- multishot only */}
      {isMulti && (
        <CollapsibleSection
          title="Elements"
          storageKey="video-sidebar-elements"
          defaultOpen
        >
          <RefImageStrip
            images={sidebar.elements.map((el) => ({
              id: el.id,
              url: el.frontalImageUrl,
              title: el.label,
            }))}
            max={6}
            onAdd={() => setElementPickerOpen(true)}
            onRemove={sidebar.removeElement}
            onImageClick={() => setElementPickerOpen(true)}
            showLabels
          />
        </CollapsibleSection>
      )}

      {/* Shots -- multishot only */}
      {isMulti && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Shots</label>
            <button
              type="button"
              onClick={sidebar.clearPrompts}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear prompts
            </button>
          </div>
          <div className="space-y-2">
            {sidebar.shots.map((shot, i) => {
              const otherTotal = sidebar.shots
                .filter((s) => s.id !== shot.id)
                .reduce((sum, s) => sum + s.duration, 0)
              const maxForThis = 15 - otherTotal
              return (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  index={i}
                  maxDuration={maxForThis}
                  canDelete={sidebar.shots.length > 1}
                  onUpdate={sidebar.updateShot}
                  onRemove={sidebar.removeShot}
                />
              )
            })}
          </div>
          {sidebar.shots.length < 6 &&
            sidebar.shots.reduce((s, sh) => s + sh.duration, 0) + 3 <= 15 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={sidebar.addShot}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
        </div>
      )}

      {/* Transition prompt -- FLF only */}
      {isFlf && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">
              Transition Prompt
            </label>
            <button
              type="button"
              onClick={sidebar.clearPrompts}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear prompt
            </button>
          </div>
          <Textarea
            placeholder="Describe how the scene transitions between frames..."
            value={sidebar.prompt}
            onChange={(e) => sidebar.setPrompt(e.target.value)}
            rows={3}
          />
        </div>
      )}

      {/* Duration -- FLF only */}
      {isFlf && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Duration</label>
          <div className="flex gap-1">
            {durations.map((d) => (
              <button
                key={d}
                onClick={() => sidebar.setDuration(d)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded border transition-colors',
                  sidebar.duration === d
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
      )}

      {/* CFG Scale -- FLF only */}
      {isFlf && selectedModel?.supportsCfgScale !== false && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            CFG Scale ({sidebar.cfgScale.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sidebar.cfgScale}
            onChange={(e) => sidebar.setCfgScale(parseFloat(e.target.value))}
            className="w-full accent-accent-brand"
          />
        </div>
      )}

      {/* Negative prompt -- FLF only */}
      {isFlf && selectedModel?.supportsNegativePrompt !== false && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Negative Prompt
          </label>
          <Textarea
            placeholder="Things to avoid in the video..."
            value={sidebar.negativePrompt}
            onChange={(e) => sidebar.setNegativePrompt(e.target.value)}
            rows={2}
          />
        </div>
      )}

      {/* Multishot settings */}
      {isMulti && (
        <CollapsibleSection
          title="Settings"
          storageKey="video-sidebar-multishot-settings"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Aspect Ratio</Label>
                <Select
                  value={sidebar.aspectRatio}
                  onValueChange={(v) =>
                    sidebar.setAspectRatio(v as '16:9' | '9:16' | '1:1')
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="1:1">1:1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Shot Type</Label>
                <Select
                  value={sidebar.shotType}
                  onValueChange={(v) =>
                    sidebar.setShotType(v as 'customize' | 'intelligent')
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customize">Customize</SelectItem>
                    <SelectItem value="intelligent">Intelligent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Generate Audio</Label>
              <Switch
                checked={sidebar.generateAudio}
                onCheckedChange={sidebar.setGenerateAudio}
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Error */}
      {sidebar.error && (
        <p className="text-xs text-destructive">{sidebar.error}</p>
      )}

      {/* Generate button */}
      <Button
        onClick={() => void sidebar.generate()}
        disabled={disabled}
        className="w-full"
      >
        {generateLabel}
      </Button>

      {creditBalance !== null && creditBalance !== undefined && (
        <p className="text-center text-xs text-muted-foreground">
          {creditBalance} credits
        </p>
      )}

      {/* First frame / Start image source dialog */}
      <ImageSourceDialog
        open={firstFrameDialogOpen}
        onOpenChange={setFirstFrameDialogOpen}
        title={isMulti ? 'Start Image' : 'First Frame'}
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        originalUrls={userImages.originalUrls}
        isLoading={userImages.isLoading}
        onSelect={(result) => {
          sidebar.setFirstFrame(result.url, result.id)
        }}
        onUploadToLibrary={onUploadToLibrary}
      />

      {/* Last frame source dialog -- FLF only */}
      {isFlf && (
        <ImageSourceDialog
          open={lastFrameDialogOpen}
          onOpenChange={setLastFrameDialogOpen}
          title="Last Frame"
          images={userImages.images}
          imageUrls={userImages.imageUrls}
          originalUrls={userImages.originalUrls}
          isLoading={userImages.isLoading}
          onSelect={(result) => {
            sidebar.setLastFrame(result.url, result.id)
          }}
          onUploadToLibrary={onUploadToLibrary}
        />
      )}

      {/* Element picker -- multishot only */}
      {isMulti && (
        <ExistingImagePicker
          open={elementPickerOpen}
          onOpenChange={setElementPickerOpen}
          images={userImages.images}
          imageUrls={userImages.imageUrls}
          isLoading={userImages.isLoading}
          alreadyCollectedIds={new Set()}
          onConfirm={(selected) => {
            const urls = selected
              .map(
                (img) =>
                  userImages.originalUrls[img.id] ??
                  userImages.imageUrls[img.id],
              )
              .filter(Boolean)
            sidebar.replaceElements(urls)
            setElementPickerOpen(false)
          }}
          max={6}
        />
      )}
    </div>
  )
}
