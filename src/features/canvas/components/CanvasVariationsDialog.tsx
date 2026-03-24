import { useEffect, useState } from 'react'
import { DEFAULT_EDIT_MODEL, EDIT_MODELS } from '@/features/ai-images/models'
import { detectAspectRatio } from '@/features/ai-images/constants'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'canvas-variations-prefs'

interface CanvasVariationsDialogProps {
  open: boolean
  onClose: () => void
  onGenerate: (opts: {
    model: string
    aspectRatio: string
    count: number
    prompt?: string
  }) => void
  isGenerating: boolean
  sourceWidth?: number
  sourceHeight?: number
}

const ASPECT_RATIOS = [
  { label: 'Same', value: '' },
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
]

const COUNT_OPTIONS = [1, 2, 3, 4]

function loadPrefs(): { model: string; count: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        model:
          typeof parsed.model === 'string' ? parsed.model : DEFAULT_EDIT_MODEL,
        count: typeof parsed.count === 'number' ? parsed.count : 3,
      }
    }
  } catch {}
  return { model: DEFAULT_EDIT_MODEL, count: 3 }
}

function savePrefs(model: string, count: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ model, count }))
  } catch {}
}

export function CanvasVariationsDialog({
  open,
  onClose,
  onGenerate,
  isGenerating,
  sourceWidth,
  sourceHeight,
}: CanvasVariationsDialogProps) {
  const [model, setModel] = useState(() => loadPrefs().model)
  const [count, setCount] = useState(() => loadPrefs().count)
  const [aspectRatio, setAspectRatio] = useState('')
  const [prompt, setPrompt] = useState('')

  // Auto-detect aspect ratio from source image when dialog opens
  useEffect(() => {
    if (open && sourceWidth && sourceHeight) {
      const detected = detectAspectRatio(sourceWidth, sourceHeight)
      // Find matching ratio in our list, or default to "Same"
      const match = ASPECT_RATIOS.find((r) => r.value === detected)
      setAspectRatio(match ? detected : '')
    }
  }, [open, sourceWidth, sourceHeight])

  if (!open) return null

  function handleModelChange(value: string) {
    setModel(value)
    savePrefs(value, count)
  }

  function handleCountChange(value: number) {
    setCount(value)
    savePrefs(model, value)
  }

  function handleGenerate() {
    onGenerate({
      model,
      aspectRatio: aspectRatio || undefined!,
      count,
      prompt: prompt.trim() || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-[380px] rounded-xl border border-border bg-[#141414] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-sm font-medium text-zinc-300">
          Generate Variations
        </div>

        {/* Model */}
        <label className="mb-1 block text-xs text-zinc-500">Model</label>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="mb-3 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        >
          {EDIT_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Aspect Ratio */}
        <label className="mb-1 block text-xs text-zinc-500">Aspect Ratio</label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              onClick={() => setAspectRatio(r.value)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-colors',
                aspectRatio === r.value
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <label className="mb-1 block text-xs text-zinc-500">Count</label>
        <div className="mb-3 flex gap-1.5">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => handleCountChange(n)}
              className={cn(
                'flex-1 rounded-md border py-1.5 text-sm transition-colors',
                count === n
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500',
              )}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Prompt */}
        <label className="mb-1 block text-xs text-zinc-500">
          Prompt (optional)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Leave blank for auto-generated variations..."
          rows={3}
          className="mb-4 w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
        />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-zinc-700 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={cn(
              'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
              isGenerating
                ? 'bg-blue-500/30 text-blue-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500',
            )}
          >
            {isGenerating ? 'Generating...' : `Generate ${count}`}
          </button>
        </div>
      </div>
    </div>
  )
}
