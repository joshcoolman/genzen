import { SceneCell } from './SceneCell'
import type { ScenesState } from '../types'

interface ScenesGridProps {
  state: ScenesState
}

export function ScenesGrid({ state }: ScenesGridProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {state.cells.map((cell) => (
        <SceneCell
          key={cell.id}
          cell={cell}
          imageUrls={state.imageUrls}
          onPromptChange={(prompt) => state.setCellPrompt(cell.id, prompt)}
          onRegeneratePrompt={() => void state.regenerateCellPrompt(cell.id)}
          onRun={() => void state.runCell(cell.id)}
          onSlideChange={(index) => state.setCellSlide(cell.id, index)}
          onOpenLightbox={(slideIndex) =>
            state.openLightbox(cell.id, slideIndex)
          }
          isQueued={
            state.isGeneratingAll &&
            cell.pendingId === null &&
            !!cell.prompt.trim()
          }
          disabled={state.isGeneratingAll}
          promptsDisabled={state.isGeneratingPrompts}
        />
      ))}
    </div>
  )
}
