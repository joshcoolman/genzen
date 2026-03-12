import {
  ArrowRight,
  FlaskConical,
  Paintbrush,
  Play,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react'
import type { UseStyleTrainerPageReturn } from '../hooks/useStyleTrainerPage'
import { ActionButton } from '@/components/ActionButton'
import { EmptyStateCard } from '@/components/EmptyStateCard'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { RemoveButton } from '@/components/RemoveButton'

interface StyleTrainerPageContentProps {
  page: UseStyleTrainerPageReturn
}

export function StyleTrainerPageContent({
  page,
}: StyleTrainerPageContentProps) {
  return (
    <div className="space-y-6">
      {page.step === 'collect' && <CollectStep page={page} />}
      {page.step === 'configure' && <ConfigureStep page={page} />}
      {page.step === 'training' && <TrainingStep page={page} />}
      {page.step === 'test' && <TestStep page={page} />}
      {page.step === 'library' && <LibraryStep page={page} />}
    </div>
  )
}

function ImageSourceBar({ page }: { page: UseStyleTrainerPageReturn }) {
  return (
    <ImageSourceButtons
      onFileSelected={page.addFile}
      library={{
        images: page.existingImages.images,
        imageUrls: page.existingImages.imageUrls,
        isLoading: page.existingImages.isLoading,
        onSelect: page.selectLibraryImage,
        onSelectMultiple: page.selectLibraryImages,
        onOpen: page.existingImages.refresh,
      }}
      multiple
      className="flex items-center gap-2"
    />
  )
}

const MIN_IMAGES = 5
const MAX_IMAGES = 20

function getStyleMeter(count: number) {
  if (count >= 18)
    return {
      label: 'Excellent',
      color:
        'bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-blue-500 to-violet-500',
      textColor: 'text-amber-400',
      pct: 100,
    }
  if (count >= 14)
    return {
      label: 'Great',
      color: 'bg-emerald-400',
      textColor: 'text-emerald-400',
      pct: 85,
    }
  if (count >= 10)
    return {
      label: 'Good',
      color: 'bg-green-500',
      textColor: 'text-green-500',
      pct: 65,
    }
  if (count >= 7)
    return {
      label: 'OK',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-500',
      pct: 45,
    }
  if (count >= MIN_IMAGES)
    return {
      label: 'Minimum',
      color: 'bg-orange-400',
      textColor: 'text-orange-400',
      pct: 30,
    }
  return {
    label: `Need ${MIN_IMAGES - count} more`,
    color: 'bg-muted-foreground/40',
    textColor: 'text-muted-foreground',
    pct: (count / MIN_IMAGES) * 25,
  }
}

function StyleMeter({ count }: { count: number }) {
  const meter = getStyleMeter(count)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${meter.color} transition-all duration-300`}
          style={{ width: `${meter.pct}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium ${meter.textColor} transition-colors duration-300 whitespace-nowrap`}
      >
        {meter.label} ({count}/{MAX_IMAGES})
      </span>
    </div>
  )
}

function CollectStep({ page }: { page: UseStyleTrainerPageReturn }) {
  const count = page.referenceImages.length
  const hasImages = count > 0
  const belowMin = count < MIN_IMAGES

  const slots = Array.from({ length: MAX_IMAGES }, (_, i) => {
    return page.referenceImages[i] as
      | (typeof page.referenceImages)[number]
      | null
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ImageSourceBar page={page} />
        <div className="flex-1">
          <StyleMeter count={count} />
        </div>
        {hasImages && (
          <ActionButton
            onClick={page.goToConfigure}
            disabled={belowMin}
            icon={<ArrowRight className="size-4" />}
          >
            Next
          </ActionButton>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-12rem)]">
        <div className="w-2/3">
          <div className="grid grid-cols-5 gap-2">
            {slots.map((img, i) =>
              img ? (
                <div key={img.id} className="relative">
                  <img
                    src={img.url}
                    alt=""
                    className="aspect-square rounded-md object-cover bg-muted"
                  />
                  <RemoveButton onRemove={() => page.removeImage(img.id)} />
                </div>
              ) : (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-md border border-dashed border-border bg-muted/20"
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigureStep({ page }: { page: UseStyleTrainerPageReturn }) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-6">
        <h2 className="text-lg font-medium">Configure Style</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="style-name"
              className="text-sm font-medium text-muted-foreground"
            >
              Style Name
            </label>
            <input
              id="style-name"
              type="text"
              value={page.styleName}
              onChange={(e) => page.setStyleName(e.target.value)}
              placeholder="e.g. Watercolor, Cyberpunk, Oil Paint..."
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Reference Images ({page.referenceImages.length})
              </p>
              <ImageSourceBar page={page} />
            </div>
            <div className="grid grid-cols-6 gap-2">
              {page.referenceImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.url}
                    alt=""
                    className="aspect-square rounded object-cover bg-muted"
                  />
                  <RemoveButton
                    onRemove={() => page.removeImage(img.id)}
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={page.reset}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to images
          </button>
          <ActionButton
            onClick={page.startTraining}
            disabled={!page.styleName.trim()}
            icon={<Play className="size-4" />}
          >
            Start Training
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function TrainingStep({ page }: { page: UseStyleTrainerPageReturn }) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-6">
        <h2 className="text-lg font-medium">Training: {page.styleName}</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{page.trainingProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-brand transition-all"
              style={{ width: `${page.trainingProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Training complete. Ready to test.
          </p>
        </div>
        <div className="flex justify-center">
          <ActionButton
            onClick={page.goToTest}
            icon={<FlaskConical className="size-4" />}
          >
            Test Style
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function TestStep({ page }: { page: UseStyleTrainerPageReturn }) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-4">
        <h2 className="text-lg font-medium">Test: {page.styleName}</h2>
        <div className="flex items-center gap-4">
          <textarea
            value={page.testPrompt}
            onChange={(e) => page.setTestPrompt(e.target.value)}
            placeholder="Describe an image to generate in this style..."
            rows={2}
            className="flex-1 resize-none rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <ActionButton
            onClick={page.runTest}
            disabled={!page.testPrompt.trim()}
            icon={<Sparkles className="size-4" />}
          >
            Generate Test
          </ActionButton>
        </div>

        {page.testResults.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {page.testResults.map((result) => (
              <img
                key={result.id}
                src={result.url}
                alt=""
                className="aspect-square rounded-md object-cover bg-muted"
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <ActionButton
            onClick={page.reset}
            icon={<RotateCcw className="size-4" />}
          >
            Start Over
          </ActionButton>
          <ActionButton
            onClick={page.saveStyle}
            icon={<Save className="size-4" />}
          >
            Save Style
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function LibraryStep({ page }: { page: UseStyleTrainerPageReturn }) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-2/3 space-y-4">
        <h2 className="text-lg font-medium">Style Library</h2>
        {page.savedStyles.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {page.savedStyles.map((style) => (
              <div
                key={style.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4"
              >
                {style.thumbnailUrl ? (
                  <img
                    src={style.thumbnailUrl}
                    alt=""
                    className="size-20 rounded-lg object-cover bg-muted"
                  />
                ) : (
                  <div className="size-20 rounded-lg bg-muted" />
                )}
                <span className="text-sm font-medium">{style.name}</span>
                <span className="text-xs text-muted-foreground">
                  {style.imageCount} reference images
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateCard>
            <p className="text-sm text-muted-foreground">No saved styles yet</p>
          </EmptyStateCard>
        )}
        <div className="flex justify-start">
          <ActionButton
            onClick={page.reset}
            icon={<Paintbrush className="size-4" />}
          >
            Train New Style
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
