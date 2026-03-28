import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { GeneratePromptsDialog } from '@/features/ai-images/components/GeneratePromptsDialog'
import { PastePromptsDialog } from '@/features/ai-images/components/PastePromptsDialog'

interface PromptListProps {
  prompts: Array<string>
  onUpdatePrompt: (index: number, value: string) => void
  onAddPrompt: () => void
  onRemovePrompt: (index: number) => void
  onClear?: () => void
  canClear?: boolean
  disabled?: boolean
  placeholders?: { first: string; additional: string }
  // Optional: generate prompts capability (loosely coupled)
  onGeneratePrompts?: (opts: { count: number; guidance?: string }) => void
  generatingPrompts?: boolean
  // Optional: clear all prompts back to single empty textarea
  onClearPrompts?: () => void
  // Optional: paste multiple prompts at once
  onPastePrompts?: (prompts: Array<string>) => void
}

export function PromptList({
  prompts,
  onUpdatePrompt,
  onAddPrompt,
  onRemovePrompt,
  onClear,
  canClear,
  disabled,
  placeholders = {
    first: 'Describe your image...',
    additional: 'Additional prompt...',
  },
  onGeneratePrompts,
  generatingPrompts,
  onClearPrompts,
  onPastePrompts,
}: PromptListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
  const hasContent =
    prompts.length > 1 || (prompts.length === 1 && prompts[0].trim() !== '')
  return (
    <div className="space-y-2">
      {prompts.map((promptText, index) => (
        <div key={index} className="relative">
          <Textarea
            id={index === 0 ? 'prompt-textarea' : `prompt-textarea-${index}`}
            placeholder={
              index === 0 ? placeholders.first : placeholders.additional
            }
            value={promptText}
            onChange={(e) => onUpdatePrompt(index, e.target.value)}
            disabled={disabled || generatingPrompts}
            rows={index === 0 ? 4 : 3}
            className="text-xs pr-7"
          />
          {index === 0 ? (
            canClear && (
              <button
                type="button"
                onClick={onClear}
                className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Clear all prompts, source image, and references"
              >
                <XIcon />
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => onRemovePrompt(index)}
              className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Remove this prompt"
            >
              <XIcon />
            </button>
          )}
        </div>
      ))}
      <div
        className={
          onGeneratePrompts || onPastePrompts ? 'flex gap-2' : undefined
        }
      >
        <button
          type="button"
          onClick={onAddPrompt}
          disabled={disabled || generatingPrompts}
          className={`py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md transition-colors disabled:opacity-50 ${onGeneratePrompts || onPastePrompts ? 'flex-1' : 'w-full'}`}
        >
          + Add prompt
        </button>
        {onPastePrompts && (
          <button
            type="button"
            onClick={() => setPasteDialogOpen(true)}
            disabled={disabled || generatingPrompts}
            className="flex-1 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md transition-colors disabled:opacity-50"
          >
            Past Prompts
          </button>
        )}
        {onGeneratePrompts && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={disabled || generatingPrompts}
            className="flex-1 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md transition-colors disabled:opacity-50"
          >
            {generatingPrompts ? 'Generating...' : 'Generate prompts'}
          </button>
        )}
      </div>
      {onClearPrompts && hasContent && (
        <button
          type="button"
          onClick={onClearPrompts}
          disabled={disabled || generatingPrompts}
          className="w-full py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Clear prompts
        </button>
      )}
      {onGeneratePrompts && (
        <GeneratePromptsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onGenerate={(opts) => {
            onGeneratePrompts(opts)
            setDialogOpen(false)
          }}
          loading={generatingPrompts ?? false}
        />
      )}
      {onPastePrompts && (
        <PastePromptsDialog
          open={pasteDialogOpen}
          onOpenChange={setPasteDialogOpen}
          onAdd={onPastePrompts}
        />
      )}
    </div>
  )
}

function XIcon() {
  return (
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
  )
}
