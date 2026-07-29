'use client'

import { useState } from 'react'
import styles from './paste-prompts-dialog.module.css'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '#/components'

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
      <DialogContent className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Paste Prompts</DialogTitle>
        </DialogHeader>
        <div className={styles.body}>
          <Textarea
            placeholder="Paste prompts separated by blank lines, or use * as a delimiter..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
          />
          {parsed.length > 0 && (
            <p className={styles.count}>
              {parsed.length} prompt{parsed.length !== 1 ? 's' : ''} detected
            </p>
          )}
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={parsed.length === 0}
            className={styles.submit}
          >
            Add {parsed.length || ''} prompt{parsed.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
