import { useState } from 'react'

interface ModelPickerButtonProps {
  models: Array<{ id: string; name: string; description?: string }>
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}

export function ModelPickerButton({
  models,
  selectedId,
  onSelect,
  className,
}: ModelPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const selected = models.find((m) => m.id === selectedId)

  if (models.length <= 1) {
    return (
      <span className={`truncate text-[11px] text-white/70 ${className ?? ''}`}>
        {models[0]?.name ?? 'No models'}
      </span>
    )
  }

  return (
    <div className={`relative min-w-0 flex-1 ${className ?? ''}`}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="truncate text-left text-[11px] text-white/70 hover:text-white transition-colors w-full"
        title={`${selected?.name ?? selectedId} — click to change`}
      >
        {selected?.name ?? selectedId}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <div className="absolute left-0 bottom-full z-50 mb-1 w-52 rounded-md border border-border bg-popover shadow-md overflow-hidden">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(m.id)
                  setOpen(false)
                }}
                className={`flex w-full flex-col px-3 py-1.5 text-left hover:bg-muted transition-colors ${
                  m.id === selectedId ? 'bg-muted/50' : ''
                }`}
              >
                <span className="text-xs font-medium">{m.name}</span>
                {m.description && (
                  <span className="text-[10px] text-muted-foreground">
                    {m.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
