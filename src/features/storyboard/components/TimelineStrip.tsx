import type { Scene } from '../types'

interface TimelineStripProps {
  scenes: Array<Scene>
  onSceneClick: (sceneId: string) => void
}

export function TimelineStrip({ scenes, onSceneClick }: TimelineStripProps) {
  if (scenes.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-xl gap-1.5 overflow-x-auto px-4 py-2">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSceneClick(scene.id)}
            className="group relative shrink-0"
          >
            {scene.image_url ? (
              <img
                src={scene.image_url}
                alt={`Scene ${scene.scene_number}`}
                className="h-12 w-20 rounded object-cover transition-all group-hover:ring-2 group-hover:ring-accent-brand"
              />
            ) : (
              <div className="h-12 w-20 rounded bg-muted transition-all group-hover:ring-2 group-hover:ring-accent-brand" />
            )}
            <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-muted-foreground drop-shadow-md">
              {scene.scene_number}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
