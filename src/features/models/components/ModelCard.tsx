import { Check, Clipboard, ExternalLink } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { FalModel } from '../types'
import { Separator } from '@/components/ui/separator'

interface ModelCardProps {
  model: FalModel
}

export function ModelCard({ model }: ModelCardProps) {
  const [copied, setCopied] = useState(false)

  const copyEndpoint = useCallback(() => {
    navigator.clipboard.writeText(model.endpoint_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [model.endpoint_id])

  return (
    <div className="flex h-full min-h-[195px] flex-col gap-1 rounded-lg border bg-card p-3 text-left">
      <h3 className="text-base font-medium leading-tight">
        {model.display_name}
      </h3>
      <Separator className="my-1" />
      {model.description && (
        <p className="text-xs text-foreground/70">{model.description}</p>
      )}

      <div className="mt-auto">
        <Separator className="my-1" />

        <div className="flex items-center gap-1.5">
          <code className="flex-1 truncate text-[10px] text-foreground">
            {model.endpoint_id}
          </code>
          <button
            type="button"
            onClick={copyEndpoint}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy endpoint"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Clipboard className="h-3 w-3" />
            )}
          </button>
        </div>

        <Separator className="my-1" />

        <a
          href={`https://fal.ai/models/${model.endpoint_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View on FAL
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
