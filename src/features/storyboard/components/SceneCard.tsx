import { useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { Scene } from '../types'
import { ActionButton } from '@/components/ActionButton'

interface SceneCardProps {
  scene: Scene
  isGenerating: boolean
  onUpdate: (updates: Partial<Scene>) => void
  onGenerateFrame: () => void
}

export function SceneCard({
  scene,
  isGenerating,
  onUpdate,
  onGenerateFrame,
}: SceneCardProps) {
  const hasImage = !!scene.image_url

  const autoGrow = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  return (
    <div
      id={`scene-${scene.id}`}
      className="grid grid-cols-[1fr_320px] gap-4 rounded-lg border border-border bg-card p-4"
    >
      {/* Left: scene details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-brand/10 text-xs font-bold text-accent-brand">
            {scene.scene_number}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.framing}
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.camera}
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.duration_seconds}s
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {scene.emotion}
            </span>
          </div>
        </div>

        {/* Visual description (editable) */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Visual Description
          </label>
          <textarea
            value={scene.visual_description}
            onChange={(e) => {
              onUpdate({ visual_description: e.target.value })
              autoGrow(e.target)
            }}
            ref={autoGrow}
            rows={2}
            className="w-full resize-none overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Caption (editable) */}
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Caption
          </label>
          <textarea
            value={scene.caption}
            onChange={(e) => {
              onUpdate({ caption: e.target.value })
              autoGrow(e.target)
            }}
            ref={autoGrow}
            rows={1}
            className="w-full resize-none overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Action */}
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Action:</span> {scene.action}
        </p>
      </div>

      {/* Right: frame image */}
      <div className="flex flex-col gap-2">
        <div className="relative overflow-hidden rounded-md">
          {isGenerating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/40">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
          )}
          {hasImage ? (
            <img
              src={scene.image_url!}
              alt={`Scene ${scene.scene_number}`}
              className="aspect-video w-full rounded-md object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted">
              <span className="text-xs text-muted-foreground">
                Scene {scene.scene_number}
              </span>
            </div>
          )}
        </div>
        <ActionButton
          onClick={onGenerateFrame}
          disabled={isGenerating || !scene.visual_description.trim()}
          loading={isGenerating}
          loadingText="Generating..."
          icon={<RefreshCw className="size-3.5" />}
          className="w-full text-xs"
        >
          {hasImage ? 'Regenerate' : 'Generate Frame'}
        </ActionButton>
      </div>
    </div>
  )
}
