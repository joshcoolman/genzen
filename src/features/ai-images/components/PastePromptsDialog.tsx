import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ActionButton } from '@/components/ActionButton'

interface PastePromptsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (prompts: Array<string>) => void
}

function splitPrompts(text: string): Array<string> {
  const chunks = text.includes('*') ? text.split('*') : text.split(/\n\n+/)
  return chunks.map((c) => c.trim()).filter(Boolean)
}

export function PastePromptsDialog({
  open,
  onOpenChange,
  onAdd,
}: PastePromptsDialogProps) {
  const [text, setText] = useState('')

  const parsed = splitPrompts(text)

  function handleSubmit() {
    if (parsed.length === 0) return
    onAdd(parsed)
    setText('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Past Prompts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="Paste prompts separated by blank lines, or use * as a delimiter..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="text-xs"
          />
          {parsed.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {parsed.length} prompt{parsed.length !== 1 ? 's' : ''} detected
            </p>
          )}
          <ActionButton
            onClick={handleSubmit}
            disabled={parsed.length === 0}
            className="w-full"
          >
            Add {parsed.length || ''} prompt{parsed.length !== 1 ? 's' : ''}
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
