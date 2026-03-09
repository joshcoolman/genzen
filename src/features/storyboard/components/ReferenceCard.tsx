import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Reference } from '../hooks/useStoryboardPage'
import { RemoveButton } from '@/components/RemoveButton'
import { ActionButton } from '@/components/ActionButton'

interface ReferenceCardProps {
  reference: Reference
  onRemove: () => void
  onEdit: (instruction: string) => void
}

export function ReferenceCard({
  reference,
  onRemove,
  onEdit,
}: ReferenceCardProps) {
  const [instruction, setInstruction] = useState('')

  return (
    <div className="space-y-2">
      <div className="relative rounded-md border border-border bg-muted p-4">
        <span className="text-sm font-medium">{reference.label}</span>
        <RemoveButton onRemove={onRemove} size="sm" />
        {reference.status === 'generating' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Edit instruction..."
          className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <ActionButton
          onClick={() => {
            if (instruction.trim()) {
              onEdit(instruction)
              setInstruction('')
            }
          }}
          disabled={!instruction.trim() || reference.status === 'generating'}
          className="px-2 py-1 text-xs"
        >
          Apply
        </ActionButton>
      </div>
    </div>
  )
}
