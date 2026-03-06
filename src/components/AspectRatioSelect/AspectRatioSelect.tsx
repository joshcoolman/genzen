import { RectangleHorizontal, RectangleVertical } from 'lucide-react'
import { flipOrientation, getRatioOptions } from './aspect-ratio-constants'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface AspectRatioSelectProps {
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  onOrientationChange: (o: 'landscape' | 'portrait') => void
  onAspectRatioChange: (ratio: string) => void
  ratios?: { landscape?: Array<string>; portrait?: Array<string> }
  disabled?: boolean
  className?: string
}

export function AspectRatioSelect({
  orientation,
  aspectRatio,
  onOrientationChange,
  onAspectRatioChange,
  ratios,
  disabled,
  className,
}: AspectRatioSelectProps) {
  const options = ratios
    ? ((orientation === 'landscape' ? ratios.landscape : ratios.portrait) ??
      getRatioOptions(orientation))
    : getRatioOptions(orientation)

  function handleOrientationToggle() {
    const flipped = flipOrientation(orientation, aspectRatio)
    onOrientationChange(flipped.orientation)
    onAspectRatioChange(flipped.aspectRatio)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={handleOrientationToggle}
        disabled={disabled}
        title={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'}`}
        className="shrink-0"
      >
        {orientation === 'landscape' ? (
          <RectangleHorizontal className="h-4 w-4" />
        ) : (
          <RectangleVertical className="h-4 w-4" />
        )}
      </Button>
      <Select
        value={aspectRatio}
        onValueChange={onAspectRatioChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
