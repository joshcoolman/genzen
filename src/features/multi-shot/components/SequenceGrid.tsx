import { SequenceCard } from './SequenceCard'
import type { MultiShotSequence } from '../types'

interface SequenceGridProps {
  sequences: Array<MultiShotSequence>
  loading: boolean
  onNavigate: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export function SequenceGrid({
  sequences,
  loading,
  onNavigate,
  onDuplicate,
  onDelete,
}: SequenceGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  if (sequences.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">
          No sequences yet. Create your first multi-shot video.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {sequences.map((seq) => (
        <SequenceCard
          key={seq.id}
          sequence={seq}
          onNavigate={onNavigate}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
