import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ActionButton'
import { Skeleton } from '@/components/ui/skeleton'
import { RefImageStrip } from '@/components/RefImageStrip'

interface ReferenceImage {
  id: string
  url: string
  title: string
}

interface VariationPromptsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompts: Array<string>
  loading: boolean
  submitting: boolean
  onRun: (prompts: Array<string>) => void
  sourceImageUrl?: string
  referenceImages: Array<ReferenceImage>
  onAddReference: () => void
  onRemoveReference: (id: string) => void
  maxReferences?: number
}

export function VariationPromptsDialog({
  open,
  onOpenChange,
  prompts: initialPrompts,
  loading,
  submitting,
  onRun,
  sourceImageUrl,
  referenceImages,
  onAddReference,
  onRemoveReference,
  maxReferences = 5,
}: VariationPromptsDialogProps) {
  const [prompts, setPrompts] = useState<Array<string>>([])

  useEffect(() => {
    if (initialPrompts.length > 0) {
      setPrompts(initialPrompts)
    }
  }, [initialPrompts])

  function updatePrompt(index: number, value: string) {
    setPrompts((prev) => prev.map((p, i) => (i === index ? value : p)))
  }

  function removePrompt(index: number) {
    setPrompts((prev) => prev.filter((_, i) => i !== index))
  }

  function addPrompt() {
    setPrompts((prev) => [...prev, ''])
  }

  function handleRun() {
    const filtered = prompts.filter((p) => p.trim().length > 0)
    if (filtered.length > 0) {
      onRun(filtered)
    }
  }

  const validCount = prompts.filter((p) => p.trim().length > 0).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Variation Prompts</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {sourceImageUrl && (
            <div className="flex items-center gap-3 pb-1">
              <img
                src={sourceImageUrl}
                className="w-12 h-12 rounded object-cover border border-border"
                alt="Source"
              />
              <span className="text-xs text-muted-foreground">
                Source image
              </span>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">
              Reference images
            </span>
            <RefImageStrip
              images={referenceImages}
              max={maxReferences}
              onAdd={onAddReference}
              onRemove={onRemoveReference}
              disabled={submitting}
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
              <p className="text-xs text-muted-foreground text-center">
                Generating prompts...
              </p>
            </div>
          ) : (
            <>
              {prompts.map((prompt, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    value={prompt}
                    onChange={(e) => updatePrompt(i, e.target.value)}
                    rows={2}
                    className="flex-1 text-sm resize-none"
                    placeholder="Describe a variation..."
                  />
                  <button
                    onClick={() => removePrompt(i)}
                    className="self-start p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Remove prompt"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addPrompt}
                className="w-full"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add prompt
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <ActionButton
            onClick={handleRun}
            disabled={loading || validCount === 0}
            loading={submitting}
            loadingText="Running..."
          >
            Run {validCount} variation{validCount !== 1 ? 's' : ''}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
