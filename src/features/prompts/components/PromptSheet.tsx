import { useCallback, useState } from 'react'
import { Check, Copy, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { UserPrompt } from '../types'
import { cn } from '@/lib/utils'

interface PromptSheetProps {
  isOpen: boolean
  onClose: () => void
  prompts: Array<UserPrompt>
  loading: boolean
  onAdd: (title: string, content: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRestore: () => Promise<void>
  hasAllDefaults: boolean
}

export function PromptSheet({
  isOpen,
  onClose,
  prompts,
  loading,
  onAdd,
  onDelete,
  onRestore,
  hasAllDefaults,
}: PromptSheetProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    await onAdd(title.trim(), content.trim())
    setTitle('')
    setContent('')
    setAdding(false)
    setSaving(false)
  }, [title, content, onAdd])

  const handleCancel = useCallback(() => {
    setAdding(false)
    setTitle('')
    setContent('')
  }, [])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 transition-opacity duration-300',
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] min-h-[50vh] flex-col rounded-t-2xl border-t border-border bg-background transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <h2 className="text-lg font-semibold">Prompts</h2>
          <div className="flex items-center gap-2">
            {!hasAllDefaults && (
              <button
                onClick={onRestore}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Restore defaults
              </button>
            )}
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Add form */}
              {adding && (
                <div className="rounded-lg border border-primary bg-card p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Prompt title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                  <textarea
                    placeholder="Prompt content..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    className="w-full resize-none bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={handleCancel}
                      className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !title.trim() || !content.trim()}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Prompt cards -- styled like Thumbnail but text-only */}
              {prompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  confirmDeleteId={confirmDeleteId}
                  onConfirmDelete={setConfirmDeleteId}
                  onDelete={onDelete}
                />
              ))}

              {prompts.length === 0 && !adding && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">No prompts yet.</p>
                  <p className="text-xs">Add a prompt or restore defaults.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PromptCard({
  prompt,
  confirmDeleteId,
  onConfirmDelete,
  onDelete,
}: {
  prompt: UserPrompt
  confirmDeleteId: string | null
  onConfirmDelete: (id: string | null) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
      {/* Top-right actions (Thumbnail overlay pattern) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
        {confirmDeleteId === prompt.id ? (
          <>
            <button
              onClick={() => onDelete(prompt.id)}
              className="rounded bg-background/80 backdrop-blur-sm px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-all"
            >
              Delete
            </button>
            <button
              onClick={() => onConfirmDelete(null)}
              className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onConfirmDelete(prompt.id)}
            className="rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{prompt.title}</h3>
            {prompt.is_default && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                default
              </span>
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {prompt.content}
        </p>
      </div>

      {/* Copy action bar at bottom */}
      <button
        onClick={handleCopy}
        className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy prompt
          </>
        )}
      </button>
    </div>
  )
}
