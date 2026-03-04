import { useCallback, useRef, useState } from 'react'
import {
  ClipboardPaste,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Sparkles,
  Unlock,
  Wand2,
} from 'lucide-react'
import type { BrainstormModelKey } from '@/features/ai-images/server/brainstorm-images.server'
import { ActionButton } from '@/components/ActionButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBrainstorm } from '@/features/ai-images/hooks/use-brainstorm'

interface BrainstormPanelProps {
  accessToken: string | undefined
  refineModels?: Array<string>
  aspectRatio?: string
}

export function BrainstormPanel({
  accessToken,
  refineModels,
  aspectRatio: refineAspectRatio,
}: BrainstormPanelProps) {
  const [model, setModel] = useState<BrainstormModelKey>('schnell')
  const [editInstruction, setEditInstruction] = useState('')
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([])

  const focusSlot = useCallback((index: number) => {
    const el = textareaRefs.current[index]
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const brainstorm = useBrainstorm({
    accessToken,
    model,
    refineModels,
    aspectRatio: refineAspectRatio,
  })

  return (
    <div className="bg-card rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Brainstorm</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate 6 images from the prompts below. Click an image to refine.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setPasteText('')
              setPasteDialogOpen(true)
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ClipboardPaste className="size-3" />
            Paste All
          </button>
          <button
            onClick={() => void brainstorm.rewriteAllPrompts()}
            disabled={brainstorm.rewritingSlots.size > 0}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {brainstorm.rewritingSlots.size > 0 ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Wand2 className="size-3" />
            )}
            Enhance All
          </button>
          {brainstorm.hasGenerated && (
            <button
              onClick={brainstorm.clearPrompts}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset Prompts
            </button>
          )}
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="brainstorm-model"
                value="schnell"
                checked={model === 'schnell'}
                onChange={() => setModel('schnell')}
                className="accent-foreground"
              />
              Schnell
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="brainstorm-model"
                value="dev"
                checked={model === 'dev'}
                onChange={() => setModel('dev')}
                className="accent-foreground"
              />
              Dev
            </label>
          </div>
          <ActionButton
            onClick={() => void brainstorm.generate()}
            loading={brainstorm.isGenerating}
            loadingText="Generating..."
            disabled={!accessToken}
            icon={<Sparkles className="size-4" />}
          >
            {brainstorm.hasGenerated ? 'Regenerate' : 'Generate'}
          </ActionButton>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="grid grid-cols-2 gap-2 shrink-0 w-1/2">
          {brainstorm.images.map((img, i) => (
            <BrainstormSlot
              key={i}
              index={i}
              image={img}
              refineCount={brainstorm.refineCounts[i] ?? 0}
              locked={brainstorm.lockedSlots.has(i)}
              onToggleLock={() => brainstorm.toggleLock(i)}
              onRegenerate={() => void brainstorm.regenerateSlot(i)}
              onSelect={() => {
                if (img.url) void brainstorm.selectImage(img.url, i)
              }}
            />
          ))}
        </div>

        <div className="flex-1 space-y-2">
          {brainstorm.prompts.map((prompt, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs text-muted-foreground pt-2 shrink-0 w-4 text-right">
                {i + 1}
              </span>
              <textarea
                ref={(el) => {
                  textareaRefs.current[i] = el
                }}
                value={prompt}
                readOnly={brainstorm.lockedSlots.has(i)}
                onChange={(e) => brainstorm.updatePrompt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault()
                    void brainstorm.rewriteAndGenerateSlot(i)
                    const nextIndex = (i + 1) % brainstorm.prompts.length
                    setTimeout(() => focusSlot(nextIndex), 50)
                  } else if (e.key === 'Tab') {
                    e.preventDefault()
                    const nextIndex = e.shiftKey
                      ? (i - 1 + brainstorm.prompts.length) %
                        brainstorm.prompts.length
                      : (i + 1) % brainstorm.prompts.length
                    focusSlot(nextIndex)
                  }
                }}
                rows={2}
                className={`flex-1 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs font-mono text-foreground resize-none overflow-hidden ${brainstorm.lockedSlots.has(i) ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <div className="shrink-0 mt-1 flex flex-col gap-1">
                <button
                  onClick={() => void brainstorm.rewriteSlotPrompt(i)}
                  disabled={brainstorm.rewritingSlots.has(i)}
                  className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  title="Rewrite prompt with AI"
                >
                  {brainstorm.rewritingSlots.has(i) ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    brainstorm.setEditingSlot(i)
                    setEditInstruction('')
                  }}
                  disabled={brainstorm.editingSlots.has(i)}
                  className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  title="Edit prompt with specific instruction"
                >
                  {brainstorm.editingSlots.has(i) ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Pencil className="size-3.5" />
                  )}
                </button>
                <button
                  onClick={() => void brainstorm.regenerateSlot(i)}
                  disabled={brainstorm.isGenerating}
                  className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  title="Generate image from this prompt"
                >
                  <RefreshCw className="size-3.5" />
                </button>
                <button
                  onClick={() => brainstorm.toggleLock(i)}
                  className={`size-6 flex items-center justify-center rounded-md transition-colors ${brainstorm.lockedSlots.has(i) ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  title={
                    brainstorm.lockedSlots.has(i) ? 'Unlock slot' : 'Lock slot'
                  }
                >
                  {brainstorm.lockedSlots.has(i) ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <Unlock className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={brainstorm.editingSlot !== null}
        onOpenChange={(open) => {
          if (!open) brainstorm.setEditingSlot(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
          </DialogHeader>
          {brainstorm.editingSlot !== null && (
            <div className="space-y-4">
              {brainstorm.images[brainstorm.editingSlot]?.url && (
                <img
                  src={brainstorm.images[brainstorm.editingSlot].url!}
                  alt={`Brainstorm ${brainstorm.editingSlot + 1}`}
                  className="w-full max-w-xs mx-auto rounded-md"
                />
              )}
              <input
                type="text"
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editInstruction.trim()) {
                    const slot = brainstorm.editingSlot!
                    void brainstorm.editSlotPrompt(slot, editInstruction.trim())
                    brainstorm.setEditingSlot(null)
                    setEditInstruction('')
                  }
                }}
                placeholder="e.g. move subject to the left"
                className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              <div className="flex justify-end">
                <ActionButton
                  onClick={() => {
                    if (!editInstruction.trim()) return
                    const slot = brainstorm.editingSlot!
                    void brainstorm.editSlotPrompt(slot, editInstruction.trim())
                    brainstorm.setEditingSlot(null)
                    setEditInstruction('')
                  }}
                  disabled={!editInstruction.trim()}
                >
                  Apply Edit
                </ActionButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paste All Prompts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your prompt here..."
              rows={4}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
              autoFocus
            />
            <div className="flex justify-end">
              <ActionButton
                onClick={() => {
                  if (!pasteText.trim()) return
                  brainstorm.setAllPrompts(pasteText.trim())
                  setPasteDialogOpen(false)
                }}
                disabled={!pasteText.trim()}
              >
                Apply
              </ActionButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface BrainstormSlotProps {
  index: number
  image: { url: string | null; loading: boolean }
  refineCount: number
  locked: boolean
  onToggleLock: () => void
  onRegenerate: () => void
  onSelect: () => void
}

function BrainstormSlot({
  index,
  image,
  refineCount,
  locked,
  onToggleLock,
  onRegenerate,
  onSelect,
}: BrainstormSlotProps) {
  if (image.loading) {
    return (
      <div className="aspect-square bg-muted rounded-md flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!image.url) {
    return (
      <div className="aspect-square bg-muted/50 rounded-md border border-dashed border-border" />
    )
  }

  return (
    <div
      className={`aspect-square bg-muted rounded-md overflow-hidden relative ${locked ? 'ring-2 ring-foreground/40' : ''}`}
    >
      <button
        onClick={onSelect}
        className="w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center"
      >
        <img
          src={image.url}
          alt={`Brainstorm idea ${index + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </button>
      <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs font-bold rounded size-5 flex items-center justify-center leading-none pointer-events-none">
        {index + 1}
      </div>
      {refineCount > 0 && (
        <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-xs font-medium rounded px-1.5 py-0.5 leading-none pointer-events-none">
          {refineCount}x
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleLock()
        }}
        className="absolute bottom-1.5 left-1.5 size-6 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
        title={locked ? 'Unlock slot' : 'Lock slot'}
      >
        {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRegenerate()
        }}
        className="absolute bottom-1.5 right-1.5 size-6 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
        title="Regenerate this slot"
      >
        <RefreshCw className="size-3" />
      </button>
    </div>
  )
}
