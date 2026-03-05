import { useMemo } from 'react'
import { InsufficientCreditsDialog } from './InsufficientCreditsDialog'
import {
  CreditsContext,
  useCreditsProvider,
} from '@/features/credits/hooks/use-credits'
import { useInsufficientCreditsDialog } from '@/features/credits/hooks/use-insufficient-credits-dialog'

export function CreditsProvider({
  accessToken,
  children,
}: {
  accessToken: string | undefined
  children: React.ReactNode
}) {
  const credits = useCreditsProvider(accessToken)
  const { dialogState, showDialog, handleOpenChange } =
    useInsufficientCreditsDialog()

  const value = useMemo(
    () => ({
      ...credits,
      showInsufficientCredits: (cost: number) => {
        showDialog(cost, credits.balance ?? 0)
      },
    }),
    [credits, showDialog],
  )

  return (
    <CreditsContext.Provider value={value}>
      {children}
      <InsufficientCreditsDialog
        open={dialogState.open}
        onOpenChange={handleOpenChange}
        cost={dialogState.cost}
        balance={dialogState.balance}
      />
    </CreditsContext.Provider>
  )
}
