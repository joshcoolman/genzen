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
