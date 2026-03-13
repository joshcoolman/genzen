import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight, Library, RefreshCw, X } from 'lucide-react'
import type { Scene } from '../types'
import type { LightboxImage } from '@/components/Lightbox'
import type { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { Lightbox } from '@/components/Lightbox'
import { ActionButton } from '@/components/ActionButton'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'

interface SceneCardProps {
  scene: Scene
  generatingCount: number
  onUpdate: (updates: Partial<Scene>) => void
  onGenerateFrame: (count: number) => void
  onSelectFrame: (frameId: string) => void
  onAddFrameFromLibrary: (image: { id: string; url: string | null }) => void
  onAddSceneRefImage: (image: { id: string; url: string | null }) => void
  onRemoveSceneRefImage: (imageId: string) => void
  existingImages: ReturnType<typeof useExistingImages>
}

export function SceneCard({
  scene,
  generatingCount,
  onUpdate,
  onGenerateFrame,
  onSelectFrame,
  onAddFrameFromLibrary,
  onAddSceneRefImage,
  onRemoveSceneRefImage,
  existingImages,
}: SceneCardProps) {
  const hasImage = !!scene.image_url
  const isGenerating = generatingCount > 0
  const maxFrames = 9
  const available = maxFrames - scene.generated_frames.length
  const maxGenCount = Math.min(3, available)

  const [genCount, setGenCount] = useState(1)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showFrameLibrary, setShowFrameLibrary] = useState(false)
  const [showRefLibrary, setShowRefLibrary] = useState(false)
  const [showGenNotes, setShowGenNotes] = useState(
    !!scene.generation_notes.trim(),
  )

  const autoGrow = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  // Build lightbox data from frames with URLs
  const lightboxImages: Array<LightboxImage> = scene.generated_frames
    .filter((f) => f.url)
    .map((f) => ({
      id: f.id,
      url: f.url!,
      title: `Scene ${scene.scene_number} frame`,
    }))

  const lightboxImageUrls: Record<string, string> = Object.fromEntries(
    scene.generated_frames.filter((f) => f.url).map((f) => [f.id, f.url!]),
  )

  return (
    <div
      id={`scene-${scene.id}`}
      className="grid grid-cols-[1fr_320px] gap-4 rounded-lg border border-border bg-card p-4"
    >
      {/* Left: scene details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-brand/10 text-xs font-bold text-accent-brand">
            {scene.scene_number}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.framing}
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.camera}
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.duration_seconds}s
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.emotion}
            </span>
            {scene.lighting && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {scene.lighting}
              </span>
            )}
            {scene.lens && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {scene.lens}
              </span>
            )}
            {scene.angle && scene.angle !== 'eye level' && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {scene.angle}
              </span>
            )}
          </div>
        </div>

        {/* Visual description (editable) */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Visual Description
          </label>
          <textarea
            value={scene.visual_description}
            onChange={(e) => {
              onUpdate({ visual_description: e.target.value })
              autoGrow(e.target)
            }}
            ref={autoGrow}
            rows={2}
            className="w-full resize-none overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Caption (editable) */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Caption
          </label>
          <textarea
            value={scene.caption}
            onChange={(e) => {
              onUpdate({ caption: e.target.value })
              autoGrow(e.target)
            }}
            ref={autoGrow}
            rows={1}
            className="w-full resize-none overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Generation Notes (collapsible) */}
        <div>
          <button
            onClick={() => setShowGenNotes(!showGenNotes)}
            className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {showGenNotes ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Generation Notes
          </button>
          {showGenNotes && (
            <textarea
              value={scene.generation_notes}
              onChange={(e) => {
                onUpdate({ generation_notes: e.target.value })
                autoGrow(e.target)
              }}
              ref={autoGrow}
              rows={2}
              placeholder="Model-specific instructions (style, mood, technical params)..."
              className="mt-1 w-full resize-none overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}
        </div>

        {/* Action */}
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Action:</span> {scene.action}
        </p>

        {/* Scene Reference Images */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Scene References
            </span>
            <button
              onClick={() => setShowRefLibrary(true)}
              className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Add from library"
            >
              <Library className="size-3" />
            </button>
          </div>
          {scene.reference_images.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {scene.reference_images.map((ref) => (
                <div key={ref.id} className="group relative">
                  {ref.url ? (
                    <img
                      src={ref.url}
                      alt="Scene reference"
                      className="size-14 rounded object-cover"
                    />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded bg-muted">
                      <div className="size-3 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
                    </div>
                  )}
                  <button
                    onClick={() => onRemoveSceneRefImage(ref.id)}
                    className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:block"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: frame image + controls */}
      <div className="flex flex-col gap-2">
        {/* Main frame image */}
        <div className="relative overflow-hidden rounded-md">
          {isGenerating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/40">
              <div className="flex flex-col items-center gap-2">
                <div className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span className="text-[10px] text-white/80">
                  {generatingCount > 1
                    ? `${generatingCount} generating`
                    : 'Generating...'}
                </span>
              </div>
            </div>
          )}
          {hasImage ? (
            <img
              src={scene.image_url!}
              alt={`Scene ${scene.scene_number}`}
              className="aspect-video w-full cursor-pointer rounded-md object-cover"
              onClick={() => {
                const idx = lightboxImages.findIndex(
                  (li) => li.id === scene.image_id,
                )
                if (idx >= 0) setLightboxIndex(idx)
                else if (lightboxImages.length > 0) setLightboxIndex(0)
              }}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted">
              <span className="text-xs text-muted-foreground">
                Scene {scene.scene_number}
              </span>
            </div>
          )}
        </div>

        {/* Generation count control */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setGenCount(n)}
                disabled={n > maxGenCount}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  genCount === n
                    ? 'bg-accent-brand text-white'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                } ${n > maxGenCount ? 'cursor-not-allowed opacity-40' : ''} ${
                  n === 1 ? 'rounded-l-md' : ''
                } ${n === 3 ? 'rounded-r-md' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
          <ActionButton
            onClick={() => onGenerateFrame(genCount)}
            disabled={
              isGenerating || !scene.visual_description.trim() || available <= 0
            }
            loading={isGenerating}
            loadingText="Generating..."
            icon={<RefreshCw className="size-3.5" />}
            className="flex-1 text-xs"
          >
            {hasImage ? 'Generate' : 'Generate Frame'}
          </ActionButton>
          <button
            onClick={() => setShowFrameLibrary(true)}
            disabled={available <= 0}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Add frame from library"
          >
            <Library className="size-3.5" />
          </button>
        </div>

        {/* Thumbnail gallery */}
        {scene.generated_frames.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {scene.generated_frames.map((frame) => (
              <button
                key={frame.id}
                onClick={() => onSelectFrame(frame.id)}
                className={`relative overflow-hidden rounded ${
                  frame.id === scene.image_id
                    ? 'ring-2 ring-primary'
                    : 'ring-1 ring-border hover:ring-muted-foreground'
                }`}
              >
                {frame.url ? (
                  <img
                    src={frame.url}
                    alt="Frame variant"
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-card">
                    <div className="size-4 animate-spin rounded-full border-2 border-border border-t-accent-brand" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {scene.generated_frames.length > 0 && (
          <p className="text-center text-[10px] text-muted-foreground">
            {scene.generated_frames.length}/{maxFrames} frames
          </p>
        )}
      </div>

      {/* Frame Lightbox */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          imageUrls={lightboxImageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((i) =>
              i !== null ? Math.min(i + 1, lightboxImages.length - 1) : 0,
            )
          }
          onPrev={() =>
            setLightboxIndex((i) => (i !== null ? Math.max(i - 1, 0) : 0))
          }
        />
      )}

      {/* Frame Library Picker */}
      <ExistingImagePicker
        open={showFrameLibrary}
        onOpenChange={setShowFrameLibrary}
        images={existingImages.images}
        imageUrls={existingImages.imageUrls}
        isLoading={existingImages.isLoading}
        alreadyCollectedIds={new Set(scene.generated_frames.map((f) => f.id))}
        max={available}
        excludeIds={new Set(scene.generated_frames.map((f) => f.id))}
        onConfirm={(selected) => {
          for (const img of selected) {
            onAddFrameFromLibrary({ id: img.id, url: img.url })
          }
          setShowFrameLibrary(false)
        }}
      />

      {/* Scene Reference Library Picker */}
      <ExistingImagePicker
        open={showRefLibrary}
        onOpenChange={setShowRefLibrary}
        images={existingImages.images}
        imageUrls={existingImages.imageUrls}
        isLoading={existingImages.isLoading}
        alreadyCollectedIds={new Set(scene.reference_images.map((r) => r.id))}
        max={14 - scene.reference_images.length}
        excludeIds={new Set(scene.reference_images.map((r) => r.id))}
        onConfirm={(selected) => {
          for (const img of selected) {
            onAddSceneRefImage({ id: img.id, url: img.url })
          }
          setShowRefLibrary(false)
        }}
      />
    </div>
  )
}
