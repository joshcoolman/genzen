'use client'

import { ActivityPreview } from './_components/activity-preview/activity-preview'
import { ConnectionStatus } from './_components/connection-status/connection-status'
import { UserInfo } from './_components/user-info/user-info'
import { useView } from './use-view'
import { PageHeader, Stack } from '#/components'

export function View() {
  const { user, fal } = useView()

  return (
    <Stack gap={32}>
      {/* "Overview", not "Account": the nav beside it says Account, and the
          heading names the page within that section the way Style does. */}
      <PageHeader title="Overview" />
      <UserInfo user={user} />
      <ActivityPreview />
      <ConnectionStatus email={user.email} fal={fal} />
    </Stack>
  )
}
