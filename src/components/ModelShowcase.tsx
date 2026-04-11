import { Badge } from '@/components/ui/badge'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ALL_VIDEO_MODELS } from '@/features/ai-video/video-models'
import { ALL_TEXT_MODELS } from '@/lib/text-models'

interface ModelEntry {
  name: string
  description: string
  isNew?: boolean
}

function ModelCard({ model }: { model: ModelEntry }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {model.name}
        </span>
        {model.isNew && (
          <Badge variant="new" className="px-1 py-0 text-[10px]">
            New
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{model.description}</p>
    </div>
  )
}

function ModelSection({
  title,
  count,
  models,
}: {
  title: string
  count: number
  models: Array<ModelEntry>
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {title} <span className="text-muted-foreground/60">({count})</span>
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <ModelCard key={model.name} model={model} />
        ))}
      </div>
    </div>
  )
}

export function ModelShowcase() {
  const imageModels: Array<ModelEntry> = ALL_IMAGE_MODELS.map((m) => ({
    name: m.name,
    description: m.description,
  }))

  const videoModels: Array<ModelEntry> = ALL_VIDEO_MODELS.map((m) => ({
    name: m.name,
    description: m.description,
    isNew: m.isNew,
  }))

  const textModels: Array<ModelEntry> = ALL_TEXT_MODELS.map((m) => ({
    name: m.name,
    description: m.description,
    isNew: m.isNew,
  }))

  return (
    <section className="w-full space-y-6">
      <h2 className="text-center text-lg font-semibold text-foreground">
        Powered by Top-Tier AI
      </h2>
      <div className="space-y-8">
        <ModelSection
          title="Text to Image"
          count={imageModels.length}
          models={imageModels}
        />
        <ModelSection
          title="Video"
          count={videoModels.length}
          models={videoModels}
        />
        <ModelSection
          title="Text"
          count={textModels.length}
          models={textModels}
        />
      </div>
    </section>
  )
}
