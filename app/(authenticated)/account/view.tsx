'use client'

import { ActivityPreview } from './_components/activity-preview/activity-preview'
import { ConnectionStatus } from './_components/connection-status/connection-status'
import { SettingsLinks } from './_components/settings-links/settings-links'
import { UserInfo } from './_components/user-info/user-info'
import { useView } from './use-view'
import { PageHeader, Stack } from '#/components'

export function View() {
  const { user, fal } = useView()

  return (
    <Stack gap={32}>
      <PageHeader title="Account" />
      <UserInfo user={user} />
      <SettingsLinks />
      <ActivityPreview />
      <ConnectionStatus email={user.email} fal={fal} />
    </Stack>
  )
}
