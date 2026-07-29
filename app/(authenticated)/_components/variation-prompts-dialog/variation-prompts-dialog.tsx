'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  ActionButton,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RefImageStrip,
  Skeleton,
  Textarea,
} from '#/components'

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
  onGenerate: (guidance: string, count: number) => void
  onApply: (prompts: Array<string>) => void
  sourceImageUrl?: string
  referenceImages: Array<ReferenceImage>
  onAddReference: () => void
  onRemoveReference: (id: string) => void
  maxReferences?: number
}

const COUNT_OPTIONS = [1, 2, 3, 4]
const DEFAULT_COUNT = 4

export function VariationPromptsDialog({
  open,
  onOpenChange,
  prompts: initialPrompts,
  loading,
  onGenerate,
  onApply,
  sourceImageUrl,
  referenceImages,
  onAddReference,
  onRemoveReference,
  maxReferences = 5,
}: VariationPromptsDialogProps) {
  const [prompts, setPrompts] = useState<Array<string>>([])
  const [guidance, setGuidance] = useState('')
  const [count, setCount] = useState(DEFAULT_COUNT)

  // Sync incoming prompts (after generation)
  useEffect(() => {
    if (initialPrompts.length > 0) {
      setPrompts(initialPrompts)
    }
  }, [initialPrompts])

  // Reset to pre-generation state when dialog closes
  useEffect(() => {
    if (!open) {
      setPrompts([])
      setGuidance('')
      setCount(DEFAULT_COUNT)
    }
  }, [open])

  function updatePrompt(index: number, value: string) {
    setPrompts((prev) => prev.map((p, i) => (i === index ? value : p)))
  }

  function removePrompt(index: number) {
    setPrompts((prev) => prev.filter((_, i) => i !== index))
  }

  function addPrompt() {
    setPrompts((prev) => [...prev, ''])
  }

  function handlePaste(
    index: number,
    e: React.ClipboardEvent<HTMLTextAreaElement>,
  ) {
    const pasted = e.clipboardData.getData('text')
    let lines = pasted
      .split('\n\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length < 2) {
      lines = pasted
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    }
    if (lines.length >= 2) {
      e.preventDefault()
      setPrompts((prev) => {
        const next = [...prev]
        next.splice(index, 1, ...lines)
        return next
      })
    }
  }

  function handleApply() {
    const filtered = prompts.filter((p) => p.trim().length > 0)
    if (filtered.length > 0) {
      onApply(filtered)
      onOpenChange(false)
    }
  }

  const isPreGeneration = !loading && prompts.length === 0
  const validCount = prompts.filter((p) => p.trim().length > 0).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Variations</DialogTitle>
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
              disabled={loading}
            />
          </div>

          {isPreGeneration && (
            <>
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  Guidance (optional)
                </span>
                <Textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  rows={2}
                  className="resize-none"
                  placeholder="Describe a direction or mood..."
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Count</span>
                <div className="flex gap-1.5">
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`h-7 w-7 rounded text-xs font-medium transition-colors cursor-pointer ${
                        count === n
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
              <p className="text-xs text-muted-foreground text-center">
                Generating prompts...
              </p>
            </div>
          )}

          {!loading && prompts.length > 0 && (
            <>
              {prompts.map((prompt, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    value={prompt}
                    onChange={(e) => updatePrompt(i, e.target.value)}
                    onPaste={(e) => handlePaste(i, e)}
                    rows={2}
                    className="flex-1 resize-none"
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isPreGeneration ? (
            <Button onClick={() => onGenerate(guidance, count)}>
              Generate {count}
            </Button>
          ) : (
            <ActionButton
              onClick={handleApply}
              disabled={loading || validCount === 0}
              loading={loading}
              loadingText="Generating..."
            >
              Apply {validCount} prompt{validCount !== 1 ? 's' : ''}
            </ActionButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
