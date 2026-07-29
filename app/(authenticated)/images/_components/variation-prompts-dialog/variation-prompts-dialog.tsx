'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import styles from './variation-prompts-dialog.module.css'
import {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Variations</DialogTitle>
        </DialogHeader>

        <div className={styles.body}>
          {sourceImageUrl && (
            <div className={styles.sourceRow}>
              <img
                src={sourceImageUrl}
                className={styles.sourceThumb}
                alt="Source"
              />
              <span className={styles.label}>Source image</span>
            </div>
          )}

          <div className={styles.fieldTight}>
            <span className={styles.label}>Reference images</span>
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
              <div className={styles.field}>
                <span className={styles.label}>Guidance (optional)</span>
                <Textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  rows={2}
                  className={styles.textarea}
                  placeholder="Describe a direction or mood..."
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Count</span>
                <div className={styles.counts}>
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={`${styles.count} ${count === n ? styles.countSelected : ''}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {loading && (
            <div className={styles.skeletons}>
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className={styles.skeleton} />
              ))}
              <p className={styles.loadingLabel}>Generating prompts...</p>
            </div>
          )}

          {!loading && prompts.length > 0 && (
            <>
              {prompts.map((prompt, i) => (
                <div key={i} className={styles.promptRow}>
                  <Textarea
                    value={prompt}
                    onChange={(e) => updatePrompt(i, e.target.value)}
                    onPaste={(e) => handlePaste(i, e)}
                    rows={2}
                    className={styles.prompt}
                    placeholder="Describe a variation..."
                  />
                  <button
                    onClick={() => removePrompt(i)}
                    type="button"
                    className={styles.remove}
                    aria-label="Remove prompt"
                  >
                    <X />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={addPrompt}
                className={styles.addPrompt}
              >
                <Plus />
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
            <Button
              variant="primary"
              onClick={() => onGenerate(guidance, count)}
            >
              Generate {count}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={loading || validCount === 0}
              loading={loading}
            >
              {loading
                ? 'Generating...'
                : `Apply ${validCount} prompt${validCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
