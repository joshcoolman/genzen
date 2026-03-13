import { X } from 'lucide-react'
import { useADOpen } from '@/lib/use-ad-open'
import { cn } from '@/lib/utils'

export function ADPanel() {
  const { isOpen, setIsOpen } = useADOpen()

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 z-40 hidden h-screen w-80 flex-col border-l border-border bg-background transition-transform duration-300 md:flex',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">AD</span>
          <span className="text-xs text-muted-foreground">
            Assistant Director
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close AD panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages area - placeholder for Session 2/3 */}
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          Configure your API key to get started.
        </p>
      </div>

      {/* Input area - placeholder for Session 3 */}
      <div className="border-t border-border p-4">
        <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Ask AD anything...
        </div>
      </div>
    </aside>
  )
}
