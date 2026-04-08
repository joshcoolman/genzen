import { HistoryCardList } from './HistoryCard'
import type { HistoryEntry } from '../types'

interface Props {
  entries: Array<HistoryEntry>
  onCopyPrompt: (prompt: string) => void
  onUseAgain: (prompt: string) => void
}

export function HistoryListView({ entries, onCopyPrompt, onUseAgain }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <HistoryCardList
          key={entry.id}
          entry={entry}
          onCopyPrompt={onCopyPrompt}
          onUseAgain={onUseAgain}
        />
      ))}
    </div>
  )
}
