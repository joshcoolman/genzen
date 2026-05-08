import { useState } from 'react'
import { ActionButton } from '@/components/ActionButton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { CREDIT_PACKS } from '@/features/credits'
import { createCheckoutSession } from '@/features/credits/server/create-checkout-session.server'
import { useAuth } from '@/lib/auth'

interface CreditPackSelectorProps {
  /**
   * Kept for API compatibility; not invoked because the purchase completes
   * after a Stripe redirect, not in this component's lifecycle.
   */
  onPurchaseComplete?: (creditsAdded: number) => void
  compact?: boolean
}

export function CreditPackSelector({ compact }: CreditPackSelectorProps) {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [selectedPack, setSelectedPack] = useState<string>(
    CREDIT_PACKS[1].credits.toString(),
  )
  const [redirecting, setRedirecting] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  const activePack = CREDIT_PACKS.find(
    (p) => p.credits.toString() === selectedPack,
  )

  async function handlePurchase() {
    if (!activePack || redirecting || !accessToken) return
    setRedirecting(true)
    setPurchaseError(null)
    try {
      const { url } = await createCheckoutSession({
        data: { accessToken, packCredits: activePack.credits },
      })
      window.location.href = url
    } catch (err) {
      setPurchaseError(
        err instanceof Error ? err.message : 'Could not start checkout.',
      )
      setRedirecting(false)
    }
  }

  return (
    <div>
      <RadioGroup
        value={selectedPack}
        onValueChange={setSelectedPack}
        className="space-y-0"
      >
        {CREDIT_PACKS.map((pack, i) => (
          <label
            key={pack.credits}
            className={`flex items-center gap-4 ${compact ? 'px-3 py-2' : 'px-6 py-2.5'} cursor-pointer transition-colors hover:bg-muted/50 ${
              i < CREDIT_PACKS.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            <RadioGroupItem
              value={pack.credits.toString()}
              className="border-muted-foreground data-[state=checked]:border-accent-brand data-[state=checked]:text-accent-brand"
            />
            <span className="font-semibold tabular-nums w-20">
              ${pack.price}
            </span>
            <span className="text-sm text-muted-foreground">
              {pack.credits} credits &middot; {pack.description}
            </span>
          </label>
        ))}
      </RadioGroup>
      <div className={compact ? 'pt-4' : 'px-6 py-4'}>
        <ActionButton
          onClick={handlePurchase}
          loading={redirecting}
          loadingText="Redirecting..."
        >
          Buy {activePack ? `$${activePack.price}.00` : ''}
        </ActionButton>
        {purchaseError && (
          <p className="mt-2 text-xs text-destructive">{purchaseError}</p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground/70 leading-relaxed">
          You'll be redirected to Stripe to complete payment. Credits are added
          to your balance once payment succeeds.
        </p>
      </div>
    </div>
  )
}
