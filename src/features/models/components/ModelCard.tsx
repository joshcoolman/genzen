import { Check, Clipboard, ExternalLink } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { FalModel } from '../types'
import { Separator } from '@/components/ui/separator'

// Muted dark palette — [bg, text, textMuted, separator]
const COLOR_SCHEMES = [
  { bg: '#1a2a1a', text: '#c8dcc8', muted: '#8aab8a', sep: '#2a3d2a' },
  { bg: '#1a2328', text: '#c4d5dc', muted: '#88a5b0', sep: '#283640' },
  { bg: '#2a2420', text: '#dcd4c8', muted: '#b0a08a', sep: '#3d3428' },
  { bg: '#221a28', text: '#d4c8dc', muted: '#a088b0', sep: '#342a40' },
  { bg: '#28201a', text: '#dcd0c4', muted: '#b09878', sep: '#3d3028' },
  { bg: '#1a2828', text: '#c8dcdc', muted: '#88b0a8', sep: '#2a4038' },
  { bg: '#28221a', text: '#dcd4c4', muted: '#b09868', sep: '#3d3428' },
  { bg: '#201a28', text: '#d0c4dc', muted: '#9880b0', sep: '#302840' },
  { bg: '#1a2820', text: '#c8dcd0', muted: '#88b098', sep: '#2a4030' },
  { bg: '#281a20', text: '#dcc4d0', muted: '#b08098', sep: '#3d2830' },
  { bg: '#202828', text: '#d0dcdc', muted: '#90b0b0', sep: '#304040' },
  { bg: '#28281a', text: '#dcdcc4', muted: '#b0b078', sep: '#404028' },
] as const

interface ModelCardProps {
  model: FalModel
  colorIndex?: number
}

export function ModelCard({ model, colorIndex }: ModelCardProps) {
  const [copied, setCopied] = useState(false)
  const c =
    colorIndex != null ? COLOR_SCHEMES[colorIndex % COLOR_SCHEMES.length] : null

  const copyEndpoint = useCallback(() => {
    navigator.clipboard.writeText(model.endpoint_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [model.endpoint_id])

  return (
    <div
      className={`flex h-full min-h-[195px] flex-col gap-1 rounded-lg border p-3 text-left${!c ? ' bg-card' : ''}`}
      style={
        c
          ? { backgroundColor: c.bg, borderColor: c.sep, color: c.text }
          : undefined
      }
    >
      <h3
        className="text-base font-medium leading-tight"
        style={c ? { color: c.muted } : undefined}
      >
        {model.display_name}
      </h3>
      <Separator
        className="my-1"
        style={c ? { backgroundColor: c.sep } : undefined}
      />
      {model.description && (
        <p
          className={`text-xs${!c ? ' text-foreground/70' : ''}`}
          style={c ? { color: c.muted } : undefined}
        >
          {model.description}
        </p>
      )}

      <div className="mt-auto">
        <Separator
          className="my-1"
          style={c ? { backgroundColor: c.sep } : undefined}
        />

        <div className="flex items-center gap-1.5">
          <code
            className="flex-1 truncate text-[10px]"
            style={c ? { color: c.muted } : undefined}
          >
            {model.endpoint_id}
          </code>
          <button
            type="button"
            onClick={copyEndpoint}
            className={`shrink-0 transition-colors${!c ? ' text-muted-foreground hover:text-foreground' : ''}`}
            style={c ? { color: c.muted } : undefined}
            title="Copy endpoint"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Clipboard className="h-3 w-3" />
            )}
          </button>
        </div>

        <Separator
          className="my-1"
          style={c ? { backgroundColor: c.sep } : undefined}
        />

        <a
          href={`https://fal.ai/models/${model.endpoint_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-xs transition-colors${!c ? ' text-muted-foreground hover:text-foreground' : ''}`}
          style={c ? { color: c.muted } : undefined}
        >
          View on FAL
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
