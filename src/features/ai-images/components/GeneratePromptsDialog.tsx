'use client'

import { useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Textarea } from '#/components/ui/textarea'
import { NumberStepper } from '#/components/NumberStepper'
import { ActionButton } from '#/components/ActionButton'
import { generateShotList } from '#/features/ai-images/server/generate-shot-list.server'

interface GeneratePromptsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (prompts: Array<string>) => void
  imageBase64: string
}

export function GeneratePromptsDialog({
  open,
  onOpenChange,
  onApply,
  imageBase64,
}: GeneratePromptsDialogProps) {
  const [count, setCount] = useState(6)
  const [guidance, setGuidance] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Array<string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setResults(null)
    setError(null)
    setLoading(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { prompts } = await generateShotList({
        imageBase64,
        count,
        guidance: guidance.trim() || undefined,
      })
      setResults(prompts)
    } catch {
      setError('Failed to generate prompts. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [imageBase64, count, guidance])

  function handleUpdatePrompt(index: number, value: string) {
    if (!results) return
    setResults(results.map((p, i) => (i === index ? value : p)))
  }

  function handleRemovePrompt(index: number) {
    if (!results) return
    setResults(results.filter((_, i) => i !== index))
  }

  function handleApply() {
    if (!results) return
    const filtered = results.filter((p) => p.trim())
    if (filtered.length === 0) return
    onApply(filtered)
    reset()
    onOpenChange(false)
  }

  function handleBack() {
    setResults(null)
    setError(null)
  }

  const hasResults = results !== null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {hasResults ? 'Review Prompts' : 'Generate Prompts'}
          </DialogTitle>
        </DialogHeader>

        {!hasResults ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Number of prompts
              </span>
              <NumberStepper
                value={count}
                min={1}
                max={12}
                onAdjust={(delta) =>
                  setCount((c) => Math.min(12, Math.max(1, c + delta)))
                }
                disabled={loading}
              />
            </div>
            <Textarea
              placeholder="e.g., different times of day, detail views, action shots..."
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              disabled={loading}
              rows={2}
              className="text-xs"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <ActionButton
              onClick={handleGenerate}
              loading={loading}
              loadingText="Generating prompts..."
              className="w-full"
            >
              Generate {count} prompts
            </ActionButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {results.map((prompt, index) => (
                <div key={index} className="relative">
                  <Textarea
                    value={prompt}
                    onChange={(e) => handleUpdatePrompt(index, e.target.value)}
                    className="text-xs pr-7 resize-none"
                    rows={Math.max(2, Math.ceil(prompt.length / 45))}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePrompt(index)}
                    className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Remove this prompt"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
              >
                Back
              </button>
              <ActionButton
                onClick={handleApply}
                disabled={results.filter((p) => p.trim()).length === 0}
                className="flex-1"
              >
                Apply {results.filter((p) => p.trim()).length} prompts
              </ActionButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
