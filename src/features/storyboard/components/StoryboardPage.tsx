import { Loader2 } from 'lucide-react'
import { StoryPromptSection } from './StoryPromptSection'
import { CharacterPanel } from './CharacterPanel'
import { SceneList } from './SceneList'
import { TimelineStrip } from './TimelineStrip'
import type { UseStoryboardReturn } from '../hooks/useStoryboard'

interface StoryboardPageProps {
  sb: UseStoryboardReturn
}

export function StoryboardPage({ sb }: StoryboardPageProps) {
  if (sb.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const scrollToScene = (sceneId: string) => {
    const el = document.getElementById(`scene-${sceneId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className={sb.hasScenes ? 'pb-20' : ''}>
      <div className="mx-auto max-w-4xl space-y-8 px-4">
        {/* Story prompt section */}
        <StoryPromptSection sb={sb} />

        {/* Character panel (appears after scene generation) */}
        {sb.hasScenes && <CharacterPanel sb={sb} />}

        {/* Scenes section (appears after generation) */}
        {sb.hasScenes && <SceneList sb={sb} />}

        {/* Save indicator */}
        {sb.isSaving && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* Timeline strip (sticky bottom) */}
      {sb.hasScenes && (
        <TimelineStrip scenes={sb.scenes} onSceneClick={scrollToScene} />
      )}
    </div>
  )
}
