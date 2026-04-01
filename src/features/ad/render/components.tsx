import { defineRegistry } from '@json-render/react'
import { Check, Copy, Save } from 'lucide-react'
import { useState } from 'react'
import { adCatalog } from './catalog'

export interface ComponentHandlers {
  onCopyPrompt: (prompt: string) => void
  onSavePrompt: (title: string, content: string) => void
}

export function createADRegistry(handlers: ComponentHandlers) {
  const { registry } = defineRegistry(adCatalog, {
    components: {
      PromptCard: ({ props }) => {
        const [copied, setCopied] = useState(false)
        const [saved, setSaved] = useState(false)

        const handleCopy = () => {
          handlers.onCopyPrompt(props.prompt)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }

        const handleSave = () => {
          const title = props.title || 'Generated Prompt'
          handlers.onSavePrompt(title, props.prompt)
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        }

        return (
          <div className="my-3 rounded-lg border border-border bg-card p-4">
            {/* Title */}
            {props.title && (
              <div className="mb-2 font-medium text-sm">{props.title}</div>
            )}

            {/* Prompt content */}
            <div className="mb-3 rounded bg-muted/50 p-3 text-sm font-mono leading-relaxed whitespace-pre-wrap">
              {props.prompt}
            </div>

            {/* Tags */}
            {props.tags && props.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {props.tags.map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted"
              >
                {saved ? (
                  <>
                    <Check className="h-3 w-3" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        )
      },
    },
  })

  return registry
}
