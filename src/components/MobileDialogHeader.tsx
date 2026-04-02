import { X } from 'lucide-react'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface MobileDialogHeaderProps {
  title: string
  onClose: () => void
}

/**
 * Standardized header for full-screen mobile dialogs
 * Sticky header with title (left) and close button (right)
 */
export function MobileDialogHeader({
  title,
  onClose,
}: MobileDialogHeaderProps) {
  return (
    <DialogHeader className="px-3 py-2.5 border-b border-border sticky top-0 bg-background z-10 flex-row items-center justify-between space-y-0 min-h-0">
      <DialogTitle className="text-sm font-medium leading-none">
        {title}
      </DialogTitle>
      <button
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center text-white hover:text-white/80 transition-colors -mr-1"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </DialogHeader>
  )
}
