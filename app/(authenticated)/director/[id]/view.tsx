'use client'

import { Workspace } from '../_components/workspace/workspace'
import { SessionHeading } from '../_components/session-heading/session-heading'
import { useView } from './use-view'
import type { Session } from '../_lib/types'
import { Stack } from '#/components'

export function View({ initial }: { initial: Session }) {
  const state = useView(initial)
  return (
    <Stack gap={24}>
      <SessionHeading name={state.session.name} id={initial.id} />
      <Workspace state={state} />
    </Stack>
  )
}
