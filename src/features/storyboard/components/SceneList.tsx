import { Images } from 'lucide-react'
import { SceneRow } from './SceneRow'
import type { UseStoryboardPageReturn } from '../hooks/useStoryboardPage'
import { ActionButton } from '@/components/ActionButton'

interface SceneListProps {
  page: UseStoryboardPageReturn
}

export function SceneList({ page }: SceneListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {page.references.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {page.references.map((ref) => (
              <span
                key={ref.id}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {ref.label}
              </span>
            ))}
          </div>
        ) : (
          <div />
        )}
        <ActionButton
          onClick={page.generateAllFrames}
          loading={page.isGenerating}
          loadingText="Generating all..."
          icon={<Images className="size-4" />}
        >
          Generate All Frames
        </ActionButton>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-2/3 space-y-6">
          {page.scenes.map((scene, i) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              index={i}
              onPromptChange={(prompt) =>
                page.updateScenePrompt(scene.id, prompt)
              }
              onRegenerate={() => page.regenerateFrame(scene.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
