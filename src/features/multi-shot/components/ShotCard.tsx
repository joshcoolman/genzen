import { Minus, Plus, X } from 'lucide-react'
import { MIN_SHOT_DURATION } from '../types'
import type { Shot } from '../types'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface ShotCardProps {
  shot: Shot
  index: number
  maxDuration: number
  canDelete: boolean
  onUpdate: (
    id: string,
    updates: Partial<Pick<Shot, 'prompt' | 'duration'>>,
  ) => void
  onRemove: (id: string) => void
}

export function ShotCard({
  shot,
  index,
  maxDuration,
  canDelete,
  onUpdate,
  onRemove,
}: ShotCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Shot {index + 1}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={shot.duration <= MIN_SHOT_DURATION}
              onClick={() => onUpdate(shot.id, { duration: shot.duration - 1 })}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center tabular-nums">
              {shot.duration}s
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={shot.duration >= maxDuration}
              onClick={() => onUpdate(shot.id, { duration: shot.duration + 1 })}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(shot.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <Textarea
        placeholder="Describe what happens in this shot..."
        value={shot.prompt}
        onChange={(e) => onUpdate(shot.id, { prompt: e.target.value })}
        rows={2}
        className="resize-none text-sm"
      />
    </div>
  )
}
