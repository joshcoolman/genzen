import { Link, createFileRoute } from '@tanstack/react-router'
import { Receipt } from 'lucide-react'
import { useAccountStatus } from '@/lib/account-status'
import { useCredits } from '@/features/credits/hooks/use-credits'

import { ActionButton } from '@/components/ActionButton'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
  const accountStatus = useAccountStatus()
  const credits = useCredits()

  if (accountStatus !== 'active') {
    return (
      <div className="space-y-8">
        <PageHeader title="Home" />
        <SectionCard>
          <div className="text-center space-y-3">
            <h2 className="text-xl font-semibold text-accent-gold">
              You're on the list
            </h2>
            <p className="text-muted-foreground">
              Thanks for signing up. We'll let you know when your account is
              activated.
            </p>
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Home" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SectionCard>
          <p className="text-sm text-muted-foreground">
            Current credits balance
          </p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums mt-4">
            {credits.dollarBalance ?? '--'}
          </p>
          <div className="grid gap-3 mt-5">
            <ActionButton asChild>
              <Link to="/dashboard/credits">Manage credits</Link>
            </ActionButton>
            <Button variant="outline" asChild>
              <Link to="/dashboard/credits" className="gap-2">
                <Receipt className="h-4 w-4" />
                Go to billing
              </Link>
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
