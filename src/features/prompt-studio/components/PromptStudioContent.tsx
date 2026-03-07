import { Loader2, RotateCcw, Send } from 'lucide-react'
import { TEXT_MODELS } from '../text-models'
import { PROMPT_MODES } from '../types'
import { ModelResultCard } from './ModelResultCard'
import type { UsePromptStudioReturn } from '../hooks/usePromptStudio'
import { ModelMultiSelect } from '@/components/ModelMultiSelect'
import { ActionButton } from '@/components/ActionButton'

interface PromptStudioContentProps {
  studio: UsePromptStudioReturn
}

export function PromptStudioContent({ studio }: PromptStudioContentProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      studio.run()
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        {/* Three-column text areas */}
        <div className="grid grid-cols-3 gap-4 items-start">
          <div className="space-y-1.5">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="prompt-input"
            >
              Prompt
            </label>
            <textarea
              id="prompt-input"
              value={studio.prompt}
              onChange={(e) => studio.setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="An elf walks into a bar..."
              className="w-full min-h-[350px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none [field-sizing:content]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="system-prompt"
            >
              System Prompt
            </label>
            <textarea
              id="system-prompt"
              value={studio.customSystemPrompt}
              onChange={(e) => studio.setCustomSystemPrompt(e.target.value)}
              placeholder="Instructions for the model..."
              className="w-full min-h-[350px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none [field-sizing:content]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="negative-prompt"
            >
              Avoid
            </label>
            <textarea
              id="negative-prompt"
              value={studio.negativePrompt}
              onChange={(e) => studio.setNegativePrompt(e.target.value)}
              placeholder="Words to avoid..."
              className="w-full min-h-[350px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none [field-sizing:content]"
            />
          </div>
        </div>

        {/* Mode + Models + Run on one line */}
        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Mode</label>
            <div className="flex gap-1">
              {PROMPT_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => studio.setMode(m.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    studio.mode === m.id
                      ? 'bg-accent-brand text-black'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-muted-foreground">Models</label>
            <ModelMultiSelect
              models={TEXT_MODELS}
              selectedIds={studio.selectedModelIds}
              onToggle={studio.toggleModel}
            />
          </div>

          {(studio.isSystemPromptModified ||
            studio.isNegativePromptModified) && (
            <button
              onClick={studio.restoreDefaults}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="size-3" />
              Restore Defaults
            </button>
          )}

          <ActionButton
            onClick={studio.run}
            loading={studio.running}
            loadingText="Running..."
            icon={<Send className="size-4" />}
            disabled={
              !studio.prompt.trim() || studio.selectedModelIds.length === 0
            }
          >
            Run
          </ActionButton>
        </div>
      </div>

      {studio.running && (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">
            Running across {studio.selectedModelIds.length} model
            {studio.selectedModelIds.length !== 1 ? 's' : ''}...
          </span>
        </div>
      )}

      {studio.results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studio.results.map((result) => (
            <ModelResultCard key={result.modelId} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
