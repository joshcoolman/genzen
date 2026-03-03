import { Check, ImagePlus, Loader2, Plus, RefreshCw } from 'lucide-react'
import { ASPECT_RATIOS, DESCRIBER_MODELS } from '../hooks/useImageDescriber'
import type { UseImageDescriberReturn } from '../hooks/useImageDescriber'
import { ActionButton } from '@/components/ActionButton'
import { FileUploadButton } from '@/components/FileUploadButton'
import { ClipboardPasteButton } from '@/components/ClipboardPasteButton'

interface ImageDescriberCardProps {
  describer: UseImageDescriberReturn
}

export function ImageDescriberCard({ describer }: ImageDescriberCardProps) {
  const {
    status,
    sourceImage,
    description,
    generatedImageUrl,
    error,
    model,
    aspectRatio,
    isSaving,
    isSaved,
    openPicker,
    selectFile,
    setModel,
    setAspectRatio,
    regenerateDescription,
    regenerateImage,
    reset,
    saveImage,
  } = describer

  const canRegenDescription =
    sourceImage && (status === 'complete' || status === 'error')
  const canRegenImage =
    description && (status === 'complete' || status === 'error')

  return (
    <div className="space-y-4">
      <hr className="border-border" />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Image-to-Image Pipeline
        </h3>
      </div>

      {/* Settings row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={status === 'generating'}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {DESCRIBER_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            disabled={status === 'generating'}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Column 1: Source Image */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Source</p>
          <div className="aspect-square rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center">
            {sourceImage ? (
              <img
                src={sourceImage.url}
                alt={sourceImage.title}
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Select an image below
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ClipboardPasteButton onImagePasted={selectFile} />
            <FileUploadButton
              onFilesSelected={(files) => {
                if (files[0]) selectFile(files[0])
              }}
              multiple={false}
            />
            <ActionButton
              onClick={openPicker}
              icon={<ImagePlus className="size-4" />}
            >
              Library
            </ActionButton>
          </div>
        </div>

        {/* Column 2: Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Description</p>
            {canRegenDescription && (
              <button
                onClick={regenerateDescription}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="size-3" />
              </button>
            )}
          </div>
          <div className="aspect-square rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center p-3">
            {status === 'describing' && (
              <div className="text-center space-y-2">
                <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Analyzing...</p>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground leading-relaxed overflow-y-auto max-h-full">
                {description}
              </p>
            )}
            {status === 'idle' && (
              <p className="text-xs text-muted-foreground">
                Select an image to start
              </p>
            )}
          </div>
        </div>

        {/* Column 3: Generated Image */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Generated</p>
            {canRegenImage && (
              <button
                onClick={regenerateImage}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="size-3" />
              </button>
            )}
          </div>
          <div className="relative aspect-square rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center">
            {status === 'generating' && (
              <div className="text-center space-y-2">
                <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Generating...</p>
              </div>
            )}
            {generatedImageUrl && (
              <img
                src={generatedImageUrl}
                alt="Generated"
                className="h-full w-full object-contain bg-black"
              />
            )}
            {status === 'idle' && (
              <p className="text-xs text-muted-foreground">
                Waiting for description
              </p>
            )}
            {status === 'complete' && generatedImageUrl && (
              <button
                onClick={saveImage}
                disabled={isSaving || isSaved}
                className="absolute bottom-2 right-2 flex items-center justify-center size-8 rounded-md bg-background/80 border border-border text-foreground hover:bg-background transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isSaved ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs text-destructive">{error}</p>
          <ActionButton onClick={reset} className="mt-2 text-xs">
            Try Again
          </ActionButton>
        </div>
      )}
    </div>
  )
}
