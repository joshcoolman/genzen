'use client'

import { SessionContent } from '../_components/session-content/session-content'
import { useView } from './use-view'
import type { SavedExport, Session } from '../_lib/types'

export function View({
  initial,
  initialExports,
}: {
  initial: Session
  initialExports: Array<SavedExport>
}) {
  const state = useView(initial)
  return <SessionContent state={state} initialExports={initialExports} />
}
