import { useState } from 'react'
import { Image, ImageIcon, Layers, Loader2, Wand2, X } from 'lucide-react'
import {
  STORY_FRAME_MODELS,
  STYLE_FRAME_MODELS,
} from '../hooks/useStoryboardPage'
import type { UseStoryboardPageReturn } from '../hooks/useStoryboardPage'
import { ActionButton } from '@/components/ActionButton'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'
import { LibraryPickerDialog } from '@/components/LibraryPickerButton'
import { useAuth } from '@/lib/auth'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'

interface StoryInputProps {
  page: UseStoryboardPageReturn
}

export function StoryInput({ page }: StoryInputProps) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const library = useUserImages(userId)
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

      {/* Shared library picker dialog */}
      <LibraryPickerDialog
        open={librarySlotIndex !== null}
        onOpenChange={(open) => {
          if (!open) setLibrarySlotIndex(null)
        }}
        images={library.images}
        imageUrls={library.imageUrls}
        isLoading={library.isLoading}
        onSelect={(selected) => {
          if (librarySlotIndex !== null) {
            page.setStyleFrameSlot(librarySlotIndex, selected.id, selected.url)
            setLibrarySlotIndex(null)
          }
        }}
      />
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
