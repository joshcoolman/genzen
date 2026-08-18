'use client'

import styles from './view.module.css'
import { AccountStats } from './_components/account-stats/account-stats'
import { ActivityPreview } from './_components/activity-preview/activity-preview'
import { ConnectionStatus } from './_components/connection-status/connection-status'
import { UserInfo } from './_components/user-info/user-info'
import { useView } from './use-view'
import type { AccountStats as Stats } from '#/lib/server/account-stats.server'
import { PageHeader, Stack } from '#/components'

export function View({ stats }: { stats: Stats }) {
  const { user, checks, isCheckingConnections } = useView()

  return (
    <Stack gap={32}>
      {/* "Overview", not "Account": the nav beside it says Account, and the
          heading names the page within that section the way Style does. */}
      <PageHeader title="Overview" />
      <div className={styles.grid}>
        {/* Who you are, then what you have done. The two-thirds column is the
            substance -- the right column is things you glance at. */}
        <div className={styles.primary}>
          <UserInfo user={user} />
          <AccountStats stats={stats} />
        </div>
        <div className={styles.secondary}>
          <ConnectionStatus checks={checks} isLoading={isCheckingConnections} />
          <ActivityPreview />
        </div>
      </div>
    </Stack>
  )
}
