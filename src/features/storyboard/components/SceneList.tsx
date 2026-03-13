import { SceneCard } from './SceneCard'
import type { UseStoryboardReturn } from '../hooks/useStoryboard'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { useAuth } from '@/lib/auth'

interface SceneListProps {
  sb: UseStoryboardReturn
}

export function SceneList({ sb }: SceneListProps) {
  const { user } = useAuth()
  const existingImages = useExistingImages(user?.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{sb.scenes.length} Scenes</h2>
      </div>

      <div className="space-y-4">
        {sb.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            generatingCount={sb.generatingSceneCounts.get(scene.id) ?? 0}
            onUpdate={(updates) => sb.updateScene(scene.id, updates)}
            onGenerateFrame={(count) => sb.generateFrame(scene.id, count)}
            onSelectFrame={(frameId) => sb.selectFrame(scene.id, frameId)}
            onAddFrameFromLibrary={(image) =>
              sb.addFrameFromLibrary(scene.id, image)
            }
            onAddSceneRefImage={(image) => sb.addSceneRefImage(scene.id, image)}
            onRemoveSceneRefImage={(imageId) =>
              sb.removeSceneRefImage(scene.id, imageId)
            }
            existingImages={existingImages}
          />
        ))}
      </div>
    </div>
  )
}
