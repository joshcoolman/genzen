import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Film, Image as ImageIcon, Lock, Sparkles } from 'lucide-react'
import type { ImageModel } from '@/features/ai-images/models'
import type { VideoModel } from '@/features/ai-video/video-models'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ALL_VIDEO_MODELS } from '@/features/ai-video/video-models'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/pricing')({
  component: PricingRoute,
})

type Tab = 'all' | 'image' | 'video'

interface UnifiedPricingModel {
  id: string
  name: string
  kind: 'image' | 'video'
  displayPrice?: string
  useCase?: string
  description: string
  capabilities: Array<string>
  isNew?: boolean
  locked?: boolean
  provider: string
}

function deriveImageProvider(m: ImageModel): string {
  if (m.provider === 'google') return 'Google'
  if (m.id.startsWith('xai/')) return 'xAI'
  if (m.id.includes('gpt-image')) return 'OpenAI (via FAL)'
  return 'FAL AI'
}

function imageCapabilities(m: ImageModel): Array<string> {
  const caps: Array<string> = []
  if (m.supportsImageInput) caps.push('Reference images')
  if (m.imageInputModelId) caps.push('Edit-capable')
  return caps
}

function videoCapabilities(m: VideoModel): Array<string> {
  const caps: Array<string> = []
  if (m.supportsI2V) caps.push('Image-to-video')
  if (m.supportsFlf) caps.push('First/last frame')
  if (m.supportsCfgScale) caps.push('CFG scale')
  if (m.supportsNegativePrompt) caps.push('Negative prompt')
  caps.push(`Durations: ${m.durations.join(', ')}s`)
  return caps
}

function buildModels(): Array<UnifiedPricingModel> {
  const images: Array<UnifiedPricingModel> = ALL_IMAGE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    kind: 'image',
    displayPrice: m.displayPrice,
    useCase: m.useCase,
    description: m.description,
    capabilities: imageCapabilities(m),
    isNew: m.isNew,
    locked: m.locked,
    provider: deriveImageProvider(m),
  }))
  const videos: Array<UnifiedPricingModel> = ALL_VIDEO_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    kind: 'video',
    displayPrice: m.displayPrice,
    useCase: m.useCase,
    description: m.description,
    capabilities: videoCapabilities(m),
    isNew: m.isNew,
    locked: m.locked,
    provider: m.id.includes('sora') ? 'OpenAI (via FAL)' : 'FAL AI',
  }))
  return [...images, ...videos]
}

function PricingCard({ model }: { model: UnifiedPricingModel }) {
  const KindIcon = model.kind === 'video' ? Film : ImageIcon
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <KindIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground truncate">
              {model.name}
            </h3>
            {model.isNew && (
              <span className="rounded bg-accent-brand/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-brand">
                New
              </span>
            )}
            {model.locked && (
              <Lock className="h-3 w-3 text-muted-foreground/60" />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.useCase ?? model.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-semibold text-foreground tabular-nums">
            {model.displayPrice ?? '—'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {model.capabilities.map((cap) => (
          <span
            key={cap}
            className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {cap}
          </span>
        ))}
      </div>

      <div className="border-t border-border pt-2 text-[10px] text-muted-foreground/60">
        {model.provider}
      </div>
    </div>
  )
}

function PricingRoute() {
  const [tab, setTab] = useState<Tab>('all')
  const allModels = useMemo(buildModels, [])

  const filtered = useMemo(() => {
    if (tab === 'all') return allModels
    return allModels.filter((m) => m.kind === tab)
  }, [allModels, tab])

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: allModels.length },
    {
      id: 'image',
      label: 'Image',
      count: allModels.filter((m) => m.kind === 'image').length,
    },
    {
      id: 'video',
      label: 'Video',
      count: allModels.filter((m) => m.kind === 'video').length,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-brand" />
          <h1 className="text-xl font-semibold text-foreground">
            Model Pricing
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          What every generation costs. Use this to develop intuition for which
          model fits which job.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm transition-colors',
              tab === t.id
                ? 'border-accent-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] text-muted-foreground/60 tabular-nums">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <PricingCard key={m.id} model={m} />
        ))}
      </div>

      <p className="pt-4 text-[11px] text-muted-foreground/60 leading-relaxed">
        Prices shown are typical per-generation estimates and may vary slightly
        with image dimensions or video duration. The Activity log records the
        exact cost for every generation.
      </p>
    </div>
  )
}
