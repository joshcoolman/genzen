import { HistoryCardGrid } from './HistoryCard'
import type { HistoryEntry } from '../types'

interface Props {
  entries: Array<HistoryEntry>
  onCopyPrompt: (prompt: string) => void
  onUseAgain: (prompt: string) => void
}

export function HistoryGridView({ entries, onCopyPrompt, onUseAgain }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {entries.map((entry) => (
        <HistoryCardGrid
          key={entry.id}
          entry={entry}
          onCopyPrompt={onCopyPrompt}
          onUseAgain={onUseAgain}
        />
      ))}
    </div>
  )
}
