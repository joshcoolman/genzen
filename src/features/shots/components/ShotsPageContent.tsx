import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { SHOT_MODELS } from '../hooks/useShotsPage'
import { ShotsPipelineStep } from './ShotsPipelineStep'
import type { UseShotsPageReturn } from '../hooks/useShotsPage'
import { ActionButton } from '@/components/ActionButton'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { FileUploadButton } from '@/components/FileUploadButton'
import { ClipboardPasteButton } from '@/components/ClipboardPasteButton'
import { LibraryPickerButton } from '@/components/LibraryPickerButton'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'

interface ShotsPageContentProps {
  page: UseShotsPageReturn
}

export function ShotsPageContent({ page }: ShotsPageContentProps) {
  const hasImage = !!page.sourceImageUrl

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 overflow-hidden">
      {/* Left column: Source image + pipeline steps */}
      <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
        <ImageSourceButtons
          onFileSelected={page.setSourceImage}
          library={{
            images: page.existingImages.images,
            imageUrls: page.existingImages.imageUrls,
            isLoading: page.existingImages.isLoading,
            onSelect: page.selectLibraryImage,
            onOpen: page.existingImages.refresh,
          }}
          className="flex flex-wrap items-center gap-2"
        />
        <div className="aspect-square w-full rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center">
          {page.sourceImageUrl ? (
            <img
              src={page.sourceImageUrl}
              alt="Source"
              className="size-full object-contain bg-black"
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              Select an image
            </span>
          )}
        </div>
        {hasImage && (
          <button
            type="button"
            onClick={page.reset}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        )}
        {/* Image Description - auto-runs, collapsible to edit */}
        <ShotsPipelineStep
          title="Image Description"
          status={page.step1.status}
          storageKey="shots-step-description"
        >
          <textarea
            className="w-full min-h-[4lh] resize-none rounded-md border border-border bg-background px-3 py-2 text-xs font-light leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            style={
              {
                fieldSizing: 'content',
                fontFamily: "'DM Sans', sans-serif",
              } as React.CSSProperties
            }
            placeholder={
              hasImage ? 'Describing image...' : 'Select an image first'
            }
            value={page.step1.output}
            onChange={(e) => page.step1.setOutput(e.target.value)}
          />
          {page.step1.error && (
            <p className="mt-1 text-xs text-destructive">{page.step1.error}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!hasImage || page.step1.status === 'running'}
              onClick={page.describeImage}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3" />
              Re-describe
            </button>
            <LibraryPickerButton
              images={page.existingImages.images}
              imageUrls={page.existingImages.imageUrls}
              isLoading={page.existingImages.isLoading}
              onSelect={page.describeFromLibrary}
              onOpen={page.existingImages.refresh}
              className="shrink-0"
            />
            <FileUploadButton
              onFilesSelected={(files) => {
                if (files[0]) page.describeFromFile(files[0])
              }}
              className="shrink-0"
            />
            <ClipboardPasteButton
              onImagePasted={page.describeFromFile}
              className="shrink-0"
            />
          </div>
        </ShotsPipelineStep>

        {/* Prompt Template - with count stepper in header */}
        <ShotsPipelineStep
          title="Prompt Template"
          status="idle"
          storageKey="shots-step-template"
          headerRight={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => page.step2.setCount(page.step2.count - 1)}
                disabled={page.step2.count <= 1}
                className="rounded border border-border p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer"
              >
                <Minus className="size-3" />
              </button>
              <span className="w-6 text-center text-sm font-medium">
                {page.step2.count}
              </span>
              <button
                type="button"
                onClick={() => page.step2.setCount(page.step2.count + 1)}
                disabled={page.step2.count >= 10}
                className="rounded border border-border p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer"
              >
                <Plus className="size-3" />
              </button>
            </div>
          }
        >
          <textarea
            className="w-full min-h-[3lh] resize-none rounded-md border border-border bg-background px-3 py-2 text-xs font-light leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            style={
              {
                fieldSizing: 'content',
                fontFamily: "'DM Sans', sans-serif",
              } as React.CSSProperties
            }
            value={page.step2.template}
            onChange={(e) => page.step2.setTemplate(e.target.value)}
          />
        </ShotsPipelineStep>

        {/* Prompts - slide view of generated prompts */}
        {page.splitPrompts.length > 0 && (
          <ShotsPipelineStep
            title="Prompts"
            status={page.step3.status}
            storageKey="shots-step-prompts"
          >
            <PromptSlideView
              prompts={page.splitPrompts}
              onEdit={(index, value) => {
                const updated = [...page.splitPrompts]
                updated[index] = value
                page.step3.setOutput(updated.join(' * '))
              }}
            />
            {page.step3.error && (
              <p className="mt-1 text-xs text-destructive">
                {page.step3.error}
              </p>
            )}
            <button
              type="button"
              disabled={
                page.step1.status !== 'complete' ||
                page.step3.status === 'running'
              }
              onClick={page.generatePrompts}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3" />
              Regenerate Prompts
            </button>
          </ShotsPipelineStep>
        )}

        {/* Single Generate button */}
        <ActionButton
          onClick={page.generateImages}
          disabled={!page.canGenerate}
          loading={page.isGenerating}
          loadingText="Generating..."
        >
          Generate Images
        </ActionButton>
      </div>

      {/* Right column: Generated images */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Generated Images
          </h3>
          <select
            value={page.modelId}
            onChange={(e) => page.setModelId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SHOT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {page.generationResults.error && (
          <p className="text-sm text-destructive">
            {page.generationResults.error}
          </p>
        )}
        {page.generationResults.results.length > 0 ? (
          <GenerationResultsGrid
            results={page.generationResults.results}
            onDelete={(id) => page.generationResults.deleteResult(id)}
            onAdd={(result) => result.url && page.setSourceFromUrl(result.url)}
            title=""
            prefsKey="shots-results"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Generated images will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function PromptSlideView({
  prompts,
  onEdit,
}: {
  prompts: Array<string>
  onEdit: (index: number, value: string) => void
}) {
  const [current, setCurrent] = useState(0)
  const idx = Math.min(current, prompts.length - 1)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrent((v) => Math.max(0, v - 1))}
          disabled={idx <= 0}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-xs text-muted-foreground">
          {idx + 1} of {prompts.length}
        </span>
        <button
          type="button"
          onClick={() => setCurrent((v) => Math.min(prompts.length - 1, v + 1))}
          disabled={idx >= prompts.length - 1}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <textarea
        className="w-full min-h-[3lh] resize-none rounded-md border border-border bg-background px-3 py-2 text-xs font-light leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
        style={
          {
            fieldSizing: 'content',
            fontFamily: "'DM Sans', sans-serif",
          } as React.CSSProperties
        }
        value={prompts[idx]}
        onChange={(e) => onEdit(idx, e.target.value)}
      />
    </div>
  )
}
