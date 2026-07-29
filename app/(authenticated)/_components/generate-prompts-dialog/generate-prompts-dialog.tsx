'use client'

import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import styles from './generate-prompts-dialog.module.css'
import { NumberStepper, Textarea } from '#/components'
// Deep imports while the barrel still holds the shadcn Dialog and Button for
// their remaining consumers -- see #193.
import { Button } from '#/components/button/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/dialog/dialog'
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
      <DialogContent className={styles.popup}>
        <DialogHeader>
          <DialogTitle>
            {hasResults ? 'Review Prompts' : 'Generate Prompts'}
          </DialogTitle>
        </DialogHeader>

        {!hasResults ? (
          <div className={styles.form}>
            <div className={styles.countRow}>
              <span className={styles.label}>Number of prompts</span>
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
            />
            {error && <p className={styles.error}>{error}</p>}
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={loading}
              className={styles.generate}
            >
              {loading ? 'Generating prompts...' : `Generate ${count} prompts`}
            </Button>
          </div>
        ) : (
          <div className={styles.results}>
            <div className={styles.list}>
              {results.map((prompt, index) => (
                <div key={index} className={styles.promptRow}>
                  <Textarea
                    value={prompt}
                    onChange={(e) => handleUpdatePrompt(index, e.target.value)}
                    className={styles.prompt}
                    rows={Math.max(2, Math.ceil(prompt.length / 45))}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePrompt(index)}
                    className={styles.remove}
                    title="Remove this prompt"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                onClick={handleBack}
                className={styles.action}
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={results.filter((p) => p.trim()).length === 0}
                className={styles.action}
              >
                Apply {results.filter((p) => p.trim()).length} prompts
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
