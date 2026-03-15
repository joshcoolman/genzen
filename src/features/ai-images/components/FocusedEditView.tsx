import { useCallback, useState } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { useFocusedEdit } from '@/features/ai-images/hooks/use-focused-edit'
import { EDIT_MODELS } from '@/features/ai-images/models'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'
import { GenerationResultsGrid } from '@/components/GenerationResultsGrid'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/ActionButton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FocusedEditViewProps {
  edit: ReturnType<typeof useFocusedEdit>
}

export function FocusedEditView({ edit }: FocusedEditViewProps) {
  const [imgHeight, setImgHeight] = useState<number>(0)
  const [showPrompt, setShowPrompt] = useState(false)

  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (!el) return
    const measure = () => setImgHeight(el.offsetHeight)
    el.onload = measure
    measure()
  }, [])

  if (edit.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading image...</p>
      </div>
    )
  }

  if (!edit.sourceImage) {
    return (
      <div className="space-y-4">
        <Link
          to="/dashboard/ai-images"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Images
        </Link>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">Image not found</h3>
          <p className="text-sm text-muted-foreground">
            {edit.error ?? 'This image may have been deleted.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/ai-images"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Images
        </Link>
        {edit.credits.balance !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {edit.credits.balance} credits
          </span>
        )}
      </div>

      {/* Toolbar: selectors left, generate button right */}
      <div className="flex items-center gap-2">
        <AspectRatioSelect
          orientation={edit.orientation}
          aspectRatio={edit.aspectRatio}
          onOrientationChange={edit.setOrientation}
          onAspectRatioChange={edit.setAspectRatio}
          disabled={edit.editLoading}
        />
        <Select
          value={edit.editModelId}
          onValueChange={edit.setEditModelId}
          disabled={edit.editLoading}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDIT_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {edit.isChained && (
          <Button
            variant="ghost"
            size="sm"
            onClick={edit.resetToOriginal}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Original
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={edit.handleDescribeJson}
          disabled={edit.jsonLoading}
        >
          {edit.jsonLoading ? 'Describing...' : 'Describe JSON'}
        </Button>
        <ActionButton
          onClick={edit.handleSubmit}
          disabled={!edit.editPrompt.trim()}
          loading={edit.editLoading}
          loadingText="Generating..."
        >
          Generate Edit
        </ActionButton>
      </div>

      {/* Source image + prompt textarea — textarea matches image height */}
      <div className="flex gap-4 items-start">
        <div className="shrink-0 w-[200px]">
          <img
            ref={imgRef}
            src={edit.sourceImage.url}
            alt={edit.sourceImage.title ?? 'Source image'}
            className="w-full rounded-lg object-contain bg-black"
          />
          {edit.sourceImage.prompt && (
            <div className="mt-1.5">
              <button
                onClick={() => setShowPrompt((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {showPrompt ? 'Hide prompt' : 'Show prompt'}
              </button>
              {showPrompt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {edit.sourceImage.prompt}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex-1">
          <Textarea
            placeholder="Describe the edit -- e.g. make the background a sunset, change hair color to red..."
            value={edit.editPrompt}
            onChange={(e) => edit.setEditPrompt(e.target.value)}
            disabled={edit.editLoading}
            autoFocus
            className="resize-none"
            style={imgHeight ? { height: imgHeight } : { minHeight: 200 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void edit.handleSubmit()
              }
            }}
          />
        </div>
      </div>

      {edit.error && <p className="text-sm text-destructive">{edit.error}</p>}

      {edit.jsonDescription && (
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-4 text-xs font-mono text-foreground">
          {(() => {
            try {
              return JSON.stringify(JSON.parse(edit.jsonDescription), null, 2)
            } catch {
              return edit.jsonDescription
            }
          })()}
        </pre>
      )}

      {/* Previous edits */}
      <GenerationResultsGrid
        results={edit.results.results}
        onDelete={edit.results.deleteResult}
        onAdd={(result) => edit.promoteToSource(result)}
        onRegenerate={(result, modelId) =>
          result.prompt && edit.handleRegenerate(result.prompt, modelId)
        }
        regenerateModels={EDIT_MODELS.map((m) => ({
          id: m.id,
          name: m.name,
        }))}
        title="Previous Edits"
        prefsKey="focused-edit-results"
      />
    </div>
  )
}
