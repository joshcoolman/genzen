import { Check, Expand, RotateCcw, Sparkles, ZoomIn } from 'lucide-react'
import type { UseShotsPageReturn } from '../hooks/useShotsPage'
import { ActionButton } from '@/components/ActionButton'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'

interface ShotsPageContentProps {
  page: UseShotsPageReturn
}

export function ShotsPageContent({ page }: ShotsPageContentProps) {
  return (
    <div className="space-y-6">
      {page.step === 'upload' && <UploadStep page={page} />}
      {page.step === 'select' && <SelectStep page={page} />}
      {page.step === 'upscale' && <UpscaleStep page={page} />}
    </div>
  )
}

function getAspectClass(ratio: string) {
  const map: Record<string, string> = {
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16]',
    '4:3': 'aspect-[4/3]',
    '3:4': 'aspect-[3/4]',
    '3:2': 'aspect-[3/2]',
    '2:3': 'aspect-[2/3]',
    '2:1': 'aspect-[2/1]',
    '1:2': 'aspect-[1/2]',
    '21:9': 'aspect-[21/9]',
    '1:1': 'aspect-square',
  }
  return map[ratio] ?? 'aspect-square'
}

function UploadStep({ page }: { page: UseShotsPageReturn }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ImageSourceButtons
          onFileSelected={page.setSourceImage}
          library={{
            images: page.existingImages.images,
            imageUrls: page.existingImages.imageUrls,
            isLoading: page.existingImages.isLoading,
            onSelect: page.selectLibraryImage,
            onOpen: page.existingImages.refresh,
          }}
          className="flex items-center gap-2"
        />
        <AspectRatioSelect
          orientation={page.orientation}
          aspectRatio={page.aspectRatio}
          onOrientationChange={page.setOrientation}
          onAspectRatioChange={page.setAspectRatio}
        />
        <div className="ml-auto">
          <ActionButton
            onClick={page.generateShots}
            disabled={!page.sourceImageUrl}
            icon={<Sparkles className="size-4" />}
          >
            Generate Shots
          </ActionButton>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-12rem)]">
        <div
          className={`flex flex-col items-end gap-2 ${page.orientation === 'portrait' ? 'h-[60vh]' : 'w-2/3'}`}
        >
          <div
            className={`${getAspectClass(page.aspectRatio)} ${page.orientation === 'portrait' ? 'h-full' : 'w-full'} rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center`}
          >
            {page.sourceImageUrl ? (
              <img
                src={page.sourceImageUrl}
                alt="Source"
                className="size-full object-contain bg-black"
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                Select an image
              </span>
            )}
          </div>
          {page.needsOutpaint && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Expand className="size-3" />
              Outpaint to fill
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SelectStep({ page }: { page: UseShotsPageReturn }) {
  const selectedCount = page.selectedIds.size
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-4">
        <h2 className="text-lg font-medium">Select Shots</h2>
        <div className="grid grid-cols-3 gap-3">
          {page.shots.map((shot) => (
            <ShotCell
              key={shot.id}
              selected={page.selectedIds.has(shot.id)}
              onToggle={() => page.toggleSelection(shot.id)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
          <ActionButton
            onClick={page.upscaleSelected}
            disabled={selectedCount === 0}
            icon={<ZoomIn className="size-4" />}
          >
            Upscale Selected
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function ShotCell({
  selected,
  onToggle,
}: {
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative aspect-square rounded-md bg-muted cursor-pointer transition-all ${
        selected
          ? 'ring-2 ring-accent-brand ring-offset-2 ring-offset-card'
          : 'hover:ring-1 hover:ring-border'
      }`}
    >
      <div
        className={`absolute top-2 right-2 size-5 rounded border flex items-center justify-center transition-colors ${
          selected
            ? 'bg-accent-brand border-accent-brand text-black'
            : 'bg-background/80 border-border'
        }`}
      >
        {selected && <Check className="size-3" />}
      </div>
    </button>
  )
}

function UpscaleStep({ page }: { page: UseShotsPageReturn }) {
  const upscaledShots = page.shots.filter((s) => page.selectedIds.has(s.id))
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-4">
        <h2 className="text-lg font-medium">Upscaled Shots</h2>
        <div className="grid grid-cols-3 gap-3">
          {upscaledShots.map((shot) => (
            <div
              key={shot.id}
              className="relative aspect-square rounded-md bg-muted"
            >
              <div className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium">
                Upscaled
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-start">
          <ActionButton
            onClick={page.reset}
            icon={<RotateCcw className="size-4" />}
          >
            Start Over
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
