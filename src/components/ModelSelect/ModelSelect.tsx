import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface ModelOption {
  id: string
  name: string
}

interface ModelSelectProps {
  models: Array<ModelOption>
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function ModelSelect({
  models,
  value,
  onValueChange,
  disabled,
  className,
}: ModelSelectProps) {
  if (models.length <= 1) {
    const name = models[0]?.name ?? 'No models'
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        {name}
      </span>
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn('w-40 shrink-0', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
