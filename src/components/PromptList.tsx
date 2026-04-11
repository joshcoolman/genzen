import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
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
  generatePromptsConfig?: {
    accessToken: string
    imageBase64: string
    onApply: (prompts: Array<string>) => void
  }
  // Optional: clear all prompts back to single empty textarea
  onClearPrompts?: () => void
  // Optional: paste multiple prompts at once
  onPastePrompts?: (prompts: Array<string>) => void
  // Optional: enhance prompt via LLM (loosely coupled — only renders if provided)
  onEnhancePrompt?: (index: number) => void | Promise<void>
  // Index of the prompt currently being enhanced (shows spinner on that row)
  enhancingPromptIndex?: number | null
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
  generatePromptsConfig,
  onClearPrompts,
  onPastePrompts,
  onEnhancePrompt,
  enhancingPromptIndex,
}: PromptListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
  const hasContent =
    prompts.length > 1 || (prompts.length === 1 && prompts[0].trim() !== '')
  return (
    <div className="space-y-2">
      {onClearPrompts && hasContent && (
        <button
          type="button"
          onClick={onClearPrompts}
          disabled={disabled}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Clear prompts
        </button>
      )}
      {prompts.map((promptText, index) => {
        const isEnhancing = enhancingPromptIndex === index
        const anyEnhancing =
          enhancingPromptIndex !== null && enhancingPromptIndex !== undefined
        const canEnhance =
          Boolean(onEnhancePrompt) &&
          promptText.trim().length > 0 &&
          !disabled &&
          !anyEnhancing
        return (
          <div key={index} className="relative">
            <Textarea
              id={index === 0 ? 'prompt-textarea' : `prompt-textarea-${index}`}
              placeholder={
                index === 0 ? placeholders.first : placeholders.additional
              }
              value={promptText}
              onChange={(e) => onUpdatePrompt(index, e.target.value)}
              disabled={disabled || isEnhancing}
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
            {onEnhancePrompt && (
              <button
                type="button"
                onClick={() => void onEnhancePrompt(index)}
                disabled={!canEnhance && !isEnhancing}
                title={
                  promptText.trim().length === 0
                    ? 'Enter a prompt to enhance'
                    : 'Enhance prompt with AI'
                }
                className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Enhancing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-2.5 w-2.5" />
                    Enhance
                  </>
                )}
              </button>
            )}
          </div>
        )
      })}
      <div
        className={
          generatePromptsConfig || onPastePrompts ? 'flex gap-2' : undefined
        }
      >
        <button
          type="button"
          onClick={onAddPrompt}
          disabled={disabled}
          className={`py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md transition-colors disabled:opacity-50 ${generatePromptsConfig || onPastePrompts ? 'flex-1' : 'w-full'}`}
        >
          + Add prompt
        </button>
        {onPastePrompts && (
          <button
            type="button"
            onClick={() => setPasteDialogOpen(true)}
            disabled={disabled}
            className="flex-1 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md transition-colors disabled:opacity-50"
          >
            Paste Prompts
          </button>
        )}
        {generatePromptsConfig && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
            className="flex-1 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md transition-colors disabled:opacity-50"
          >
            Generate prompts
          </button>
        )}
      </div>
      {generatePromptsConfig && (
        <GeneratePromptsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onApply={generatePromptsConfig.onApply}
          accessToken={generatePromptsConfig.accessToken}
          imageBase64={generatePromptsConfig.imageBase64}
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
