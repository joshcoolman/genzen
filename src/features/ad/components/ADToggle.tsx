import { MessageSquare } from 'lucide-react'
import { useADOpen } from '@/lib/use-ad-open'
import { cn } from '@/lib/utils'

export function ADToggle() {
  const { isOpen, toggleOpen } = useADOpen()

  return (
    <button
      onClick={toggleOpen}
      className={cn(
        'fixed bottom-6 right-6 z-50 hidden rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-all hover:bg-primary/90 md:block',
        isOpen && 'md:hidden',
      )}
      aria-label="Open AD panel"
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  )
}
