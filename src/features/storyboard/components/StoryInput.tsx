import { useState } from 'react'
import { Image, ImageIcon, Layers, Loader2, Wand2, X } from 'lucide-react'
import {
  STORY_FRAME_MODELS,
  STYLE_FRAME_MODELS,
} from '../hooks/useStoryboardPage'
import type { UseStoryboardPageReturn } from '../hooks/useStoryboardPage'
import { ActionButton } from '@/components/ActionButton'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'
import { useAuth } from '@/lib/auth'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface StoryInputProps {
  page: UseStoryboardPageReturn
}

export function StoryInput({ page }: StoryInputProps) {
  const [librarySlotIndex, setLibrarySlotIndex] = useState<number | null>(null)

  return (
    <div className="flex flex-col items-center">
      <div className="w-2/3 space-y-6">
        {/* Story textarea */}
        <textarea
          value={page.story}
          onChange={(e) => page.setStory(e.target.value)}
          placeholder="Write your story or concept here (1-3 paragraphs)..."
          rows={8}
          className="w-full resize-none rounded-md border border-border bg-card px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {/* Refine + Generate Style Frame row */}
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={page.refineStory}
            disabled={!page.story.trim()}
            loading={page.isRefining}
            loadingText="Refining..."
            icon={<Wand2 className="size-4" />}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Refine Story
          </ActionButton>
          <ActionButton
            onClick={page.generateStyleFrame}
            disabled={!page.story.trim() || page.isGeneratingStyle}
            loading={page.isGeneratingStyle}
            loadingText="Generating..."
            icon={<Image className="size-4" />}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Generate Style Frame
          </ActionButton>
          <select
            value={page.styleFrameModelId}
            onChange={(e) => page.setStyleFrameModelId(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            {STYLE_FRAME_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* 4 Style Frame Slots */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Style Frames ({page.filledSlotCount}/4)
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {page.styleFrameSlots.map((slot, i) => (
              <StyleFrameSlotCard
                key={i}
                slot={slot}
                index={i}
                onClear={() => page.clearStyleFrameSlot(i)}
                onOpenLibrary={() => setLibrarySlotIndex(i)}
              />
            ))}
          </div>
        </div>

        {/* Story Frame section */}
        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Story Frame</h3>
              <p className="text-xs text-muted-foreground">
                Synthesize style frames into a refined key frame
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={page.storyFrameModelId}
                onChange={(e) => page.setStoryFrameModelId(e.target.value)}
                className="h-9 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground"
              >
                {STORY_FRAME_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <ActionButton
                onClick={page.generateStoryFrame}
                disabled={
                  page.filledSlotCount === 0 || page.isGeneratingStoryFrame
                }
                loading={page.isGeneratingStoryFrame}
                loadingText="Generating..."
                icon={<Layers className="size-4" />}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Generate Story Frame
              </ActionButton>
            </div>
          </div>

          {(page.hasStoryFrame || page.isGeneratingStoryFrame) && (
            <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
              {page.isGeneratingStoryFrame && !page.storyFrameUrl ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : page.storyFrameUrl ? (
                <img
                  src={page.storyFrameUrl}
                  alt="Story frame"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          )}

          <GenerationResultsGrid
            results={page.storyFrameResults}
            onDelete={page.deleteStoryFrame}
            onSelect={page.selectStoryFrame}
            selectedId={page.selectedStoryFrameId}
            title="Story Frames"
          />
        </div>
      </div>

      {/* Library picker dialog */}
      {librarySlotIndex !== null && (
        <LibraryPickerDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setLibrarySlotIndex(null)
          }}
          onSelect={(imageId, url) => {
            page.setStyleFrameSlot(librarySlotIndex, imageId, url)
            setLibrarySlotIndex(null)
          }}
        />
      )}
    </div>
  )
}

interface StyleFrameSlotCardProps {
  slot: { imageId: string; url: string } | null
  index: number
  onClear: () => void
  onOpenLibrary: () => void
}

function StyleFrameSlotCard({
  slot,
  onClear,
  onOpenLibrary,
}: StyleFrameSlotCardProps) {
  if (!slot) {
    return (
      <button
        type="button"
        onClick={onOpenLibrary}
        className="group flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-card transition-colors hover:border-muted-foreground/50"
      >
        <ImageIcon className="size-6 text-muted-foreground/40 group-hover:text-muted-foreground/60" />
      </button>
    )
  }

  return (
    <div className="group relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-card">
      <img
        src={slot.url}
        alt="Style frame"
        className="h-full w-full object-cover"
      />
      {/* Library swap -- top left */}
      <button
        type="button"
        onClick={onOpenLibrary}
        className="absolute top-1.5 left-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
        aria-label="Select from library"
      >
        <ImageIcon className="h-3.5 w-3.5" />
      </button>
      {/* Delete -- top right */}
      <button
        type="button"
        onClick={onClear}
        className="absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
        aria-label="Clear slot"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

interface LibraryPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (imageId: string, url: string) => void
}

function LibraryPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: LibraryPickerDialogProps) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const library = useUserImages(userId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!selectedId) return
    const url = library.imageUrls[selectedId]
    if (url) {
      onSelect(selectedId, url)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col"
        style={{ width: '66vw', maxWidth: '66vw', maxHeight: '80vh' }}
      >
        <DialogHeader>
          <DialogTitle>Select from Library</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {library.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading images...
            </div>
          ) : library.images.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              No images found
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              }}
            >
              {library.images.map((img) => {
                const url = library.imageUrls[img.id]
                const isSelected = selectedId === img.id
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedId(img.id)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                      isSelected
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={img.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <ActionButton onClick={handleConfirm} disabled={!selectedId}>
            Select Image
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
