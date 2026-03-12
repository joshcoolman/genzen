import { Images } from 'lucide-react'
import { FRAME_MODELS } from '../types'
import { SceneCard } from './SceneCard'
import type { UseStoryboardReturn } from '../hooks/useStoryboard'
import { ActionButton } from '@/components/ActionButton'

interface SceneListProps {
  sb: UseStoryboardReturn
}

export function SceneList({ sb }: SceneListProps) {
  const anyGenerating = sb.generatingSceneIds.size > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{sb.scenes.length} Scenes</h2>
        <div className="flex items-center gap-2">
          <select
            value={sb.frameModelId}
            onChange={(e) => sb.setFrameModelId(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            {FRAME_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <ActionButton
            onClick={sb.generateAllFrames}
            loading={anyGenerating}
            loadingText="Generating..."
            icon={<Images className="size-4" />}
          >
            Generate All Frames
          </ActionButton>
        </div>
      </div>

      <div className="space-y-4">
        {sb.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            isGenerating={sb.generatingSceneIds.has(scene.id)}
            onUpdate={(updates) => sb.updateScene(scene.id, updates)}
            onGenerateFrame={() => sb.generateFrame(scene.id)}
          />
        ))}
      </div>
    </div>
  )
}
