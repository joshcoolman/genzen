import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBrainstorm } from '@/features/ai-images/hooks/use-brainstorm'

interface BrainstormPanelProps {
  accessToken: string | undefined
}

export function BrainstormPanel({ accessToken }: BrainstormPanelProps) {
  const brainstorm = useBrainstorm({ accessToken })

  return (
    <div className="bg-card rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Brainstorm</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate 6 quick ideas with Flux Schnell. Click one to refine it
            with Nano Banana Pro.
          </p>
        </div>
        <Button
          variant={brainstorm.hasGenerated ? 'outline' : 'default'}
          size="sm"
          onClick={() => void brainstorm.trigger()}
          disabled={brainstorm.isGenerating || !accessToken}
          className="shrink-0"
        >
          {brainstorm.isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {brainstorm.hasGenerated ? 'Regenerate' : 'Brainstorm'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {brainstorm.images.map((img, i) => (
          <BrainstormSlot
            key={i}
            image={img}
            refineCount={brainstorm.refineCounts[i] ?? 0}
            onSelect={() => {
              if (img.url) void brainstorm.selectImage(img.url, i)
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface BrainstormSlotProps {
  image: { url: string | null; loading: boolean }
  refineCount: number
  onSelect: () => void
}

function BrainstormSlot({ image, refineCount, onSelect }: BrainstormSlotProps) {
  if (image.loading) {
    return (
      <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!image.url) {
    return (
      <div className="aspect-video bg-muted/50 rounded-md border border-dashed border-border" />
    )
  }

  return (
    <button
      onClick={onSelect}
      className="aspect-video rounded-md overflow-hidden relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={image.url}
        alt="Brainstorm idea"
        className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
        <span className="text-white text-xs font-medium">Refine</span>
      </div>
      {refineCount > 0 && (
        <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs font-medium rounded px-1.5 py-0.5 leading-none">
          {refineCount}×
        </div>
      )}
    </button>
  )
}
