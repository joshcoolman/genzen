import type { ReactNode } from 'react'

interface ModelCheckboxListProps {
  models: Array<{ id: string; name: string }>
  selected: Array<string>
  onToggle: (id: string, checked: boolean) => void
  disabled?: boolean
  label?: string
  headerAction?: ReactNode
}

export function ModelCheckboxList({
  models,
  selected,
  onToggle,
  disabled,
  label,
  headerAction,
}: ModelCheckboxListProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        {label && (
          <label className="block text-xs font-medium text-muted-foreground">
            {label}
          </label>
        )}
        {headerAction}
      </div>
      <div className="space-y-1">
        {models.map((m) => (
          <label
            key={m.id}
            className="flex items-center gap-2 rounded border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <input
              type="checkbox"
              value={m.id}
              checked={selected.includes(m.id)}
              onChange={(e) => onToggle(m.id, e.target.checked)}
              disabled={disabled}
              className="h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-xs font-medium">{m.name}</span>
          </label>
        ))}
      </div>
    </>
  )
}
