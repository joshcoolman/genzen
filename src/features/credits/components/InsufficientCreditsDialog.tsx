import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { CreditPackSelector } from './CreditPackSelector'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface InsufficientCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cost: number
  balance: number
}

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  cost,
  balance,
}: InsufficientCreditsDialogProps) {
  const [creditsAdded, setCreditsAdded] = useState<number | null>(null)

  function handleOpenChange(value: boolean) {
    if (!value) {
      setCreditsAdded(null)
    }
    onOpenChange(value)
  }

  function handlePurchaseComplete(amount: number) {
    setCreditsAdded(amount)
  }

  function handleDismiss() {
    setCreditsAdded(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {creditsAdded ? (
          <>
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-accent-sage" />
              <div className="text-center space-y-1">
                <DialogTitle className="text-lg font-semibold">
                  {creditsAdded} credits added
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Your balance has been updated. Happy creating.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleDismiss}>Got it</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Insufficient Credits</DialogTitle>
              <DialogDescription>
                This action requires {cost} credit{cost !== 1 ? 's' : ''}. You
                have {balance} credit{balance !== 1 ? 's' : ''} remaining.
              </DialogDescription>
            </DialogHeader>
            <CreditPackSelector
              compact
              onPurchaseComplete={handlePurchaseComplete}
            />
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
