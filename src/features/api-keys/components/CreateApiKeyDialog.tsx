import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { CopyButton } from '@/components/CopyButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface CreateApiKeyDialogProps {
  onCreate: (name: string) => Promise<string>
}

export function CreateApiKeyDialog({ onCreate }: CreateApiKeyDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setError(null)
    setRevealedKey(null)
    setSubmitting(false)
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const rawKey = await onCreate(name.trim())
      setRevealedKey(rawKey)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  return (
    <>
      <ActionButton
        icon={<Plus className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Create key
      </ActionButton>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          {revealedKey ? (
            <>
              <DialogHeader>
                <DialogTitle>API key created</DialogTitle>
                <DialogDescription>
                  Copy your key now. For security reasons, it will not be shown
                  again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 font-mono text-xs break-all">
                <span className="flex-1">{revealedKey}</span>
                <CopyButton text={revealedKey} />
              </div>
              <DialogFooter>
                <ActionButton onClick={() => handleOpenChange(false)}>
                  Done
                </ActionButton>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>
                  Give this key a name so you can recognize it later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Input
                  autoFocus
                  placeholder="e.g. My laptop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit()
                  }}
                  disabled={submitting}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
              <DialogFooter>
                <ActionButton
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  onClick={handleSubmit}
                  loading={submitting}
                  loadingText="Creating..."
                  disabled={!name.trim()}
                >
                  Create
                </ActionButton>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
