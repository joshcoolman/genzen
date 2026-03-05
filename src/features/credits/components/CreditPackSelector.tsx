import { useState } from 'react'
import { ActionButton } from '@/components/ActionButton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { CREDIT_PACKS } from '@/features/credits'
import { useCredits } from '@/features/credits/hooks/use-credits'

interface CreditPackSelectorProps {
  onPurchaseComplete?: (creditsAdded: number) => void
  compact?: boolean
}

export function CreditPackSelector({
  onPurchaseComplete,
  compact,
}: CreditPackSelectorProps) {
  const credits = useCredits()
  const [selectedPack, setSelectedPack] = useState<string>(
    CREDIT_PACKS[1].credits.toString(),
  )
  const [purchasing, setPurchasing] = useState(false)

  const activePack = CREDIT_PACKS.find(
    (p) => p.credits.toString() === selectedPack,
  )

  async function handlePurchase() {
    if (!activePack || purchasing) return
    setPurchasing(true)
    try {
      await credits.add(activePack.credits, 'pack_purchase')
      onPurchaseComplete?.(activePack.credits)
    } finally {
      setPurchasing(false)
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
          loading={purchasing}
          loadingText="Adding..."
        >
          Quick Buy {activePack ? `$${activePack.price}.00` : ''}
        </ActionButton>
      </div>
    </div>
  )
}
