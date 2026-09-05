'use client'

import { SessionContent } from '../_components/session-content/session-content'
import { SessionHeading } from '../_components/session-heading/session-heading'
import { useView } from './use-view'
import type { SavedExport, Session } from '../_lib/types'
import { Stack } from '#/components'

export function View({
  initial,
  initialExports,
}: {
  initial: Session
  initialExports: Array<SavedExport>
}) {
  const state = useView(initial)
  return (
    <Stack gap={24}>
      <SessionHeading name={state.session.name} id={initial.id} />
      <SessionContent state={state} initialExports={initialExports} />
    </Stack>
  )
}
