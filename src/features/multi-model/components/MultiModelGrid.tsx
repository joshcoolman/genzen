import { ModelShotCell } from './ModelShotCell'
import type { MultiModelState } from '../types'

interface MultiModelGridProps {
  state: MultiModelState
}

export function MultiModelGrid({ state }: MultiModelGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {state.cells.map((cell) => (
        <ModelShotCell
          key={cell.id}
          cell={cell}
          imageUrls={state.imageUrls}
          onToggleEnabled={() => state.toggleCell(cell.id)}
          onModelChange={(model) => state.setCellModel(cell.id, model)}
          onRun={() => void state.runCell(cell.id)}
          onSlideChange={(index) => state.setCellSlide(cell.id, index)}
          onOpenLightbox={(slideIndex) =>
            state.openLightbox(cell.id, slideIndex)
          }
          disabled={state.isGeneratingAll}
        />
      ))}
    </div>
  )
}
