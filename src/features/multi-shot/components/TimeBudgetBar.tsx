import { MAX_TOTAL_DURATION } from '../types'
import type { Shot } from '../types'

interface TimeBudgetBarProps {
  shots: Array<Shot>
  totalDuration: number
  estimatedCost?: string | number
}

const SHOT_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
]

export function TimeBudgetBar({
  shots,
  totalDuration,
  estimatedCost,
}: TimeBudgetBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Time Budget</span>
        <span className="tabular-nums">
          {totalDuration}/{MAX_TOTAL_DURATION}s
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
        {shots.map((shot, i) => (
          <div
            key={shot.id}
            className={`${SHOT_COLORS[i % SHOT_COLORS.length]} transition-all duration-200`}
            style={{
              width: `${(shot.duration / MAX_TOTAL_DURATION) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <div className="flex flex-1 gap-2">
          {shots.map((shot, i) => (
            <div key={shot.id} className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${SHOT_COLORS[i % SHOT_COLORS.length]}`}
              />
              <span>
                Shot {i + 1}: {shot.duration}s
              </span>
            </div>
          ))}
        </div>
        {estimatedCost && (
          <span className="shrink-0 text-[color:var(--accent-brand)]">
            Est. ${estimatedCost}
          </span>
        )}
      </div>
    </div>
  )
}
