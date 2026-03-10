import { useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

type StepStatus = 'idle' | 'running' | 'complete' | 'error'

interface ShotsPipelineStepProps {
  title: string
  status: StepStatus
  children: ReactNode
  defaultOpen?: boolean
  headerRight?: ReactNode
  storageKey?: string
}

const statusIcon: Record<StepStatus, ReactNode> = {
  idle: null,
  running: <Loader2 className="size-3.5 animate-spin text-muted-foreground" />,
  complete: <CheckCircle2 className="size-3.5 text-green-500" />,
  error: <AlertCircle className="size-3.5 text-destructive" />,
}

export function ShotsPipelineStep({
  title,
  status,
  children,
  defaultOpen = false,
  headerRight,
  storageKey,
}: ShotsPipelineStepProps) {
  const [open, setOpen] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null) return saved === 'true'
    }
    return defaultOpen
  })

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v
      if (storageKey) localStorage.setItem(storageKey, String(next))
      return next
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleToggle}
          className="flex flex-1 items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <ChevronRight
            className={`size-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          />
          {statusIcon[status]}
          <span className="text-sm font-medium flex-1">{title}</span>
        </button>
        {headerRight && (
          <div className="pr-3" onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  )
}
