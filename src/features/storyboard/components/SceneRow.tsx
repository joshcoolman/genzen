import { Loader2, RefreshCw } from 'lucide-react'
import type { Scene } from '../hooks/useStoryboardPage'
import { ActionButton } from '@/components/ActionButton'
import { PlaceholderCard } from '@/components/PlaceholderCard'

interface SceneRowProps {
  scene: Scene
  index: number
  onPromptChange: (prompt: string) => void
  onRegenerate: () => void
}

export function SceneRow({
  scene,
  index,
  onPromptChange,
  onRegenerate,
}: SceneRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 items-start">
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Scene {index + 1}
        </span>
        <textarea
          value={scene.prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex justify-end">
          <ActionButton
            onClick={onRegenerate}
            disabled={scene.status === 'generating'}
            icon={<RefreshCw className="size-3.5" />}
            className="text-xs px-3 py-1.5"
          >
            Regenerate
          </ActionButton>
        </div>
      </div>
      <div className="relative">
        {scene.status === 'generating' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
        <PlaceholderCard
          gradient={scene.gradient}
          aspectRatio="video"
          label={`Frame ${index + 1}`}
        />
      </div>
    </div>
  )
}
