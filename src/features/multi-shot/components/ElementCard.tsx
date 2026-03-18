import { X } from 'lucide-react'
import type { MultiShotElement } from '../types'
import { Button } from '@/components/ui/button'

interface ElementCardProps {
  element: MultiShotElement
  onRemove: (id: string) => void
  locked?: boolean
}

export function ElementCard({
  element,
  onRemove,
  locked = false,
}: ElementCardProps) {
  return (
    <div className="relative group">
      <div className="w-16 h-16 rounded-md border border-border overflow-hidden bg-muted">
        <img
          src={element.frontalImageUrl}
          alt={element.label}
          className="w-full h-full object-cover"
        />
      </div>
      <span className="block text-[10px] text-muted-foreground text-center mt-1 truncate w-16">
        {element.label}
      </span>
      {!locked && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onRemove(element.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
