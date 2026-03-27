import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { NumberStepper } from '@/components/NumberStepper'
import { ActionButton } from '@/components/ActionButton'

interface GeneratePromptsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (opts: { count: number; guidance?: string }) => void
  loading: boolean
}

export function GeneratePromptsDialog({
  open,
  onOpenChange,
  onGenerate,
  loading,
}: GeneratePromptsDialogProps) {
  const [count, setCount] = useState(6)
  const [guidance, setGuidance] = useState('')

  function handleSubmit() {
    onGenerate({
      count,
      guidance: guidance.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Generate Prompts</DialogTitle>
        </DialogHeader>
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
          <ActionButton
            onClick={handleSubmit}
            loading={loading}
            loadingText="Generating..."
            className="w-full"
          >
            Generate {count} prompts
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
