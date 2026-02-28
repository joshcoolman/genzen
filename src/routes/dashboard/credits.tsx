import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Image,
  Pencil,
  Scissors,
  Video,
} from 'lucide-react'
import type { CreditReason, CreditTransaction } from '@/features/credits'
import { ActionButton } from '@/components/ActionButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PageHeader } from '@/components/PageHeader'
import { StatsRow } from '@/components/StatsRow'
import { SectionCard } from '@/components/SectionCard'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'

import { getTransactions } from '@/features/credits/server/get-transactions.server'
import { CREDIT_PACKS, DOLLARS_PER_CREDIT } from '@/features/credits'

export const Route = createFileRoute('/dashboard/credits')({
  component: CreditsPage,
})

const REASON_LABELS: Record<CreditReason, string> = {
  image_gen: 'Image generation',
  variation: 'Image variation',
  edit: 'Image edit',
  first_frame: 'First frame',
  last_frame: 'Last frame',
  video_gen: 'Video generation',
  pack_purchase: 'Credit pack',
  initial_grant: 'Welcome credits',
}

const REASON_ICONS: Record<CreditReason, React.ReactNode> = {
  image_gen: <Image className="h-4 w-4" />,
  variation: <Scissors className="h-4 w-4" />,
  edit: <Pencil className="h-4 w-4" />,
  first_frame: <Image className="h-4 w-4" />,
  last_frame: <Image className="h-4 w-4" />,
  video_gen: <Video className="h-4 w-4" />,
  pack_purchase: <Gift className="h-4 w-4" />,
  initial_grant: <Gift className="h-4 w-4" />,
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDollars(credits: number) {
  return `$${(credits * DOLLARS_PER_CREDIT).toFixed(2)}`
}

function CreditsPage() {
  const { session } = useAuth()
  const credits = useCredits()
  const [transactions, setTransactions] = useState<Array<CreditTransaction>>([])
  const [selectedPack, setSelectedPack] = useState<string>(
    CREDIT_PACKS[1].credits.toString(),
  )
  const [couponCode, setCouponCode] = useState('')
  const [purchasing, setPurchasing] = useState(false)

  const activePack = CREDIT_PACKS.find(
    (p) => p.credits.toString() === selectedPack,
  )

  const refreshTransactions = useCallback(() => {
    if (!session?.access_token) return
    void getTransactions({
      data: { accessToken: session.access_token, limit: 20 },
    }).then(setTransactions)
  }, [session?.access_token])

  useEffect(() => {
    refreshTransactions()
  }, [refreshTransactions])

  async function handlePurchase() {
    if (!activePack || purchasing) return
    setPurchasing(true)
    try {
      await credits.add(activePack.credits, 'pack_purchase')
      refreshTransactions()
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credits"
        description="Track your usage, purchase credits, and manage your balance"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        }
      />

      <StatsRow
        stats={[
          {
            label: 'Current balance',
            labelClassName: 'text-warm-gold',
            value: credits.dollarBalance ?? '--',
            detail:
              credits.balance !== null
                ? `${credits.balance} credits available`
                : 'Loading...',
          },
          {
            label: 'Usage this month',
            labelClassName: 'text-warm-gold',
            value: credits.usageStats
              ? formatDollars(credits.usageStats.thisMonth)
              : '--',
            detail: credits.usageStats
              ? `${credits.usageStats.thisMonth} credits used`
              : undefined,
          },
          {
            label: 'Daily average',
            labelClassName: 'text-warm-gold',
            value: credits.usageStats
              ? formatDollars(credits.usageStats.dailyAverage)
              : '--',
            detail: credits.usageStats
              ? `${credits.usageStats.dailyAverage} credits / day`
              : undefined,
          },
        ]}
      />

      <SectionCard
        title="Add Credits"
        footer={
          <div className="flex items-center gap-3">
            <ActionButton
              onClick={handlePurchase}
              loading={purchasing}
              loadingText="Adding..."
            >
              Quick Buy {activePack ? `$${activePack.price}.00` : ''}
            </ActionButton>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-44 h-9"
              />
              <Button variant="outline" size="sm" disabled={!couponCode}>
                Redeem
              </Button>
            </div>
          </div>
        }
      >
        <RadioGroup
          value={selectedPack}
          onValueChange={setSelectedPack}
          className="space-y-0 -mx-6 -my-6"
        >
          {CREDIT_PACKS.map((pack, i) => (
            <label
              key={pack.credits}
              className={`flex items-center gap-4 px-6 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                i < CREDIT_PACKS.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <RadioGroupItem
                value={pack.credits.toString()}
                className="border-muted-foreground data-[state=checked]:border-accent-gold data-[state=checked]:text-accent-gold"
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
      </SectionCard>

      <SectionCard title="Recent Activity">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="-mx-6 -my-6">
            {transactions.map((tx, i) => (
              <div
                key={tx.id}
                className={`flex items-center gap-3 px-6 py-3 text-sm ${
                  i < transactions.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span className="text-muted-foreground">
                  {REASON_ICONS[tx.reason]}
                </span>
                <span className="flex-1 font-medium">
                  {REASON_LABELS[tx.reason]}
                </span>
                <span
                  className={
                    tx.amount > 0
                      ? 'text-accent-gold font-medium'
                      : 'text-muted-foreground'
                  }
                >
                  {tx.amount > 0 ? (
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" />+{tx.amount}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <ArrowDownLeft className="h-3 w-3" />
                      {tx.amount}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">
                  {relativeTime(tx.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
