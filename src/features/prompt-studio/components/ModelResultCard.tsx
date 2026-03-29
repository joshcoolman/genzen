import { useState } from 'react'
import { AlertCircle, Check, Copy } from 'lucide-react'
import type { ModelResult } from '../types'
import { ALL_TEXT_MODELS } from '@/lib/text-models'
import { cn } from '@/lib/utils'

interface ModelResultCardProps {
  result: ModelResult
}

export function ModelResultCard({ result }: ModelResultCardProps) {
  const [copied, setCopied] = useState(false)
  const model = ALL_TEXT_MODELS.find((m) => m.id === result.modelId)

  const handleCopy = async () => {
    if (!result.text) return
    await navigator.clipboard.writeText(result.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">
            {model?.name ?? result.modelId}
          </h3>
          <p className="text-xs text-muted-foreground">{model?.provider}</p>
        </div>
        {result.durationMs > 0 && (
          <span className="text-xs text-muted-foreground">
            {(result.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {result.error ? (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {result.text}
        </p>
      )}

      {result.text && (
        <button
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs transition-colors',
            copied
              ? 'text-green-500'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}
