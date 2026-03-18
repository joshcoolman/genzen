import { Copy, Film, Loader2, Trash2 } from 'lucide-react'
import type { MultiShotSequence } from '../types'
import { Button } from '@/components/ui/button'

interface SequenceCardProps {
  sequence: MultiShotSequence
  onNavigate: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-500/10 text-amber-500',
  processing: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-emerald-500/10 text-emerald-500',
  failed: 'bg-destructive/10 text-destructive',
}

export function SequenceCard({
  sequence,
  onNavigate,
  onDuplicate,
  onDelete,
}: SequenceCardProps) {
  const totalDuration = sequence.shots.reduce((sum, s) => sum + s.duration, 0)

  return (
    <div
      className="rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors cursor-pointer"
      onClick={() => onNavigate(sequence.id)}
    >
      {sequence.settings.startImageUrl ? (
        <div className="aspect-video w-full rounded-t-lg overflow-hidden bg-muted">
          <img
            src={sequence.settings.startImageUrl}
            alt={sequence.name}
            className="w-full h-full object-cover"
          />
          {(sequence.status === 'pending' ||
            sequence.status === 'processing') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : sequence.status === 'pending' || sequence.status === 'processing' ? (
        <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center animate-pulse">
          <Loader2 className="h-8 w-8 text-muted-foreground/40 animate-spin" />
        </div>
      ) : (
        <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center">
          <Film className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium truncate">{sequence.name}</h3>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_STYLES[sequence.status] ?? STATUS_STYLES.draft}`}
          >
            {sequence.status}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {sequence.shots.length} shot{sequence.shots.length !== 1 ? 's' : ''} /{' '}
          {totalDuration}s
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate(sequence.id)
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(sequence.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
