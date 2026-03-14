import { useCallback, useRef, useState } from 'react'
import {
  ClipboardPaste,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Unlock,
  Wand2,
} from 'lucide-react'
import type { BrainstormImage } from '@/features/ai-images/hooks/use-brainstorm'
import { ActionButton } from '@/components/ActionButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useBrainstorm } from '@/features/ai-images/hooks/use-brainstorm'
import { useBrainstormSettings } from '@/features/ai-images/hooks/use-brainstorm-settings'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { useModelSlots } from '@/lib/model-slots'
import { BRAINSTORM_MAX_ROWS } from '@/features/ai-images/constants'
import {
  REFINE_CAPABLE_MODELS,
  getModelName,
} from '@/features/ai-images/models'

interface BrainstormPanelProps {
  accessToken: string | undefined
  aspectRatio?: string
}

export function BrainstormPanel({
  accessToken,
  aspectRatio: refineAspectRatio,
}: BrainstormPanelProps) {
  const [editInstruction, setEditInstruction] = useState('')
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([])

  const credits = useCredits()
  const settings = useBrainstormSettings()
  const { slots } = useModelSlots()

  const focusSlot = useCallback((index: number) => {
    const el = textareaRefs.current[index]
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const brainstorm = useBrainstorm({
    accessToken,
    credits,
    model: slots.draft,
    refineModel: settings.refineModel,
    aspectRatio: refineAspectRatio,
    slotCount: settings.rowCount,
    imagesPerPrompt: settings.imagesPerPrompt,
  })

  const totalImages = settings.rowCount * settings.imagesPerPrompt

  return (
    <div className="bg-card rounded-lg p-6 space-y-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Brainstorm</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Generate {totalImages} image{totalImages !== 1 ? 's' : ''} from{' '}
              {settings.rowCount} prompt{settings.rowCount !== 1 ? 's' : ''}.
              Click an image to refine.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Brainstorm settings"
                >
                  <Settings className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Prompts</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          settings.setRowCount(settings.rowCount - 1)
                        }
                        disabled={settings.rowCount <= 1}
                        className="size-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="text-sm font-medium w-4 text-center">
                        {settings.rowCount}
                      </span>
                      <button
                        onClick={() =>
                          settings.setRowCount(settings.rowCount + 1)
                        }
                        disabled={settings.rowCount >= BRAINSTORM_MAX_ROWS}
                        className="size-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Images per prompt</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => settings.setImagesPerPrompt(1)}
                        className={`px-2 py-0.5 text-xs rounded border ${
                          settings.imagesPerPrompt === 1
                            ? 'border-foreground/40 bg-muted text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        1
                      </button>
                      <button
                        onClick={() => settings.setImagesPerPrompt(2)}
                        className={`px-2 py-0.5 text-xs rounded border ${
                          settings.imagesPerPrompt === 2
                            ? 'border-foreground/40 bg-muted text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        2
                      </button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Sketch</span>
              <span className="text-xs font-medium">
                {getModelName(slots.draft)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Refine</span>
              <select
                value={settings.refineModel}
                onChange={(e) => settings.setRefineModel(e.target.value)}
                className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-foreground"
              >
                {REFINE_CAPABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setPasteText('')
                setPasteDialogOpen(true)
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <ClipboardPaste className="size-3.5" />
              Paste All
            </button>
            <button
              onClick={() => void brainstorm.rewriteAllPrompts()}
              disabled={brainstorm.rewritingSlots.size > 0}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {brainstorm.rewritingSlots.size > 0 ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              Enhance All
            </button>
            {brainstorm.hasGenerated && (
              <button
                onClick={brainstorm.clearPrompts}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset Prompts
              </button>
            )}
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

      <div className="space-y-2">
        {brainstorm.prompts.map((prompt, i) => (
          <BrainstormRow
            key={i}
            index={i}
            slotImages={brainstorm.images[i] ?? []}
            prompt={prompt}
            refineCounts={brainstorm.refineCounts[i] ?? []}
            locked={brainstorm.lockedSlots.has(i)}
            rewriting={brainstorm.rewritingSlots.has(i)}
            editing={brainstorm.editingSlots.has(i)}
            isGenerating={brainstorm.isGenerating}
            imagesPerPrompt={settings.imagesPerPrompt}
            onUpdatePrompt={(val) => brainstorm.updatePrompt(i, val)}
            onRewritePrompt={() => void brainstorm.rewriteSlotPrompt(i)}
            onEditPrompt={() => {
              brainstorm.setEditingSlot(i)
              setEditInstruction('')
            }}
            onRegenerate={() => void brainstorm.regenerateSlot(i)}
            onRegenerateImage={(imgIdx) =>
              void brainstorm.regenerateSlot(i, imgIdx)
            }
            onToggleLock={() => brainstorm.toggleLock(i)}
            onSelect={(url, imgIdx) => {
              if (url) void brainstorm.selectImage(url, i, imgIdx)
            }}
            onRewriteAndGenerate={() =>
              void brainstorm.rewriteAndGenerateSlot(i)
            }
            textareaRef={(el) => {
              textareaRefs.current[i] = el
            }}
            focusSlot={focusSlot}
            totalSlots={brainstorm.prompts.length}
          />
        ))}
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
              {brainstorm.images[brainstorm.editingSlot]?.[0]?.url && (
                <img
                  src={brainstorm.images[brainstorm.editingSlot][0].url!}
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

interface BrainstormRowProps {
  index: number
  slotImages: Array<BrainstormImage>
  prompt: string
  refineCounts: Array<number>
  locked: boolean
  rewriting: boolean
  editing: boolean
  isGenerating: boolean
  imagesPerPrompt: number
  onUpdatePrompt: (value: string) => void
  onRewritePrompt: () => void
  onEditPrompt: () => void
  onRegenerate: () => void
  onRegenerateImage: (imageIndex: number) => void
  onToggleLock: () => void
  onSelect: (url: string, imageIndex: number) => void
  onRewriteAndGenerate: () => void
  textareaRef: (el: HTMLTextAreaElement | null) => void
  focusSlot: (index: number) => void
  totalSlots: number
}

function BrainstormRow({
  index,
  slotImages,
  prompt,
  refineCounts,
  locked,
  rewriting,
  editing,
  isGenerating,
  imagesPerPrompt,
  onUpdatePrompt,
  onRewritePrompt,
  onEditPrompt,
  onRegenerate,
  onRegenerateImage,
  onToggleLock,
  onSelect,
  onRewriteAndGenerate,
  textareaRef,
  focusSlot,
  totalSlots,
}: BrainstormRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex gap-1.5 shrink-0 ${imagesPerPrompt === 2 ? 'w-[464px]' : 'w-[230px]'}`}
      >
        {Array.from({ length: imagesPerPrompt }, (_, imgIdx) => {
          const image = slotImages[imgIdx] ?? { url: null, loading: false }
          return (
            <SlotImage
              key={imgIdx}
              index={index}
              imageIndex={imgIdx}
              image={image}
              locked={locked}
              refineCount={refineCounts[imgIdx] ?? 0}
              showBadge={imgIdx === 0}
              onSelect={() => {
                if (image.url) onSelect(image.url, imgIdx)
              }}
              onToggleLock={onToggleLock}
              onRegenerate={() => onRegenerateImage(imgIdx)}
            />
          )
        })}
      </div>
      <textarea
        ref={textareaRef}
        value={prompt}
        readOnly={locked}
        onChange={(e) => onUpdatePrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) {
            e.preventDefault()
            onRewriteAndGenerate()
            const nextIndex = (index + 1) % totalSlots
            setTimeout(() => focusSlot(nextIndex), 50)
          } else if (e.key === 'Tab') {
            e.preventDefault()
            const nextIndex = e.shiftKey
              ? (index - 1 + totalSlots) % totalSlots
              : (index + 1) % totalSlots
            focusSlot(nextIndex)
          }
        }}
        className={`flex-1 h-[230px] rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs font-mono text-foreground resize-none ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      <div className="shrink-0 mt-1 flex flex-col gap-1">
        <button
          onClick={onRewritePrompt}
          disabled={rewriting}
          className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="Rewrite prompt with AI"
        >
          {rewriting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
        </button>
        <button
          onClick={onEditPrompt}
          disabled={editing}
          className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="Edit prompt with specific instruction"
        >
          {editing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Pencil className="size-3.5" />
          )}
        </button>
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="Generate image from this prompt"
        >
          <RefreshCw className="size-3.5" />
        </button>
        <button
          onClick={onToggleLock}
          className={`size-6 flex items-center justify-center rounded-md transition-colors ${locked ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          title={locked ? 'Unlock slot' : 'Lock slot'}
        >
          {locked ? (
            <Lock className="size-3.5" />
          ) : (
            <Unlock className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

interface SlotImageProps {
  index: number
  imageIndex: number
  image: BrainstormImage
  locked: boolean
  refineCount: number
  showBadge: boolean
  onSelect: () => void
  onToggleLock: () => void
  onRegenerate: () => void
}

function SlotImage({
  index,
  image,
  locked,
  refineCount,
  showBadge,
  onSelect,
  onToggleLock,
  onRegenerate,
}: SlotImageProps) {
  if (image.loading) {
    return (
      <div className="w-[230px] h-[230px] shrink-0 bg-muted rounded-md flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!image.url) {
    return (
      <div className="w-[230px] h-[230px] shrink-0 bg-muted/50 rounded-md border border-dashed border-border" />
    )
  }

  return (
    <div
      className={`w-[230px] h-[230px] shrink-0 bg-muted rounded-md overflow-hidden relative ${locked ? 'ring-2 ring-foreground/40' : ''}`}
    >
      <div className="w-full h-full flex items-center justify-center">
        <img
          src={image.url}
          alt={`Brainstorm idea ${index + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      {showBadge && (
        <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs font-bold rounded size-5 flex items-center justify-center leading-none pointer-events-none">
          {index + 1}
        </div>
      )}
      <button
        onClick={onSelect}
        className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 text-white text-xs font-medium px-1.5 py-1 leading-none hover:bg-black/90 transition-colors"
        title="Refine this image"
      >
        <Wand2 className="size-3" />
        Refine{refineCount > 0 ? ` (${refineCount})` : ''}
      </button>
      <button
        onClick={onToggleLock}
        className="absolute bottom-1.5 left-1.5 size-6 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
        title={locked ? 'Unlock slot' : 'Lock slot'}
      >
        {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
      </button>
      <button
        onClick={onRegenerate}
        className="absolute bottom-1.5 right-1.5 size-6 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
        title="Regenerate this image"
      >
        <RefreshCw className="size-3" />
      </button>
    </div>
  )
}
