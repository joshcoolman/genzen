'use client'

import { Import, Plus } from 'lucide-react'
import { SessionCard } from './_components/session-card/session-card'
import { SessionList } from './_components/session-list/session-list'
import { useView } from './use-view'
import type { SessionSummary } from './_lib/types'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  NameDialog,
  PageHeader,
  Stack,
} from '#/components'

export function View({
  initial,
  owner,
}: {
  initial: Array<SessionSummary>
  owner: string
}) {
  const state = useView(initial, owner)
  return (
    <Stack gap={24}>
      <PageHeader
        title="Director"
        description={`${state.sessions.length} sessions`}
        aside={
          <Button
            disabled={state.busy}
            onClick={() => state.setFlow({ kind: 'create' })}
          >
            <Plus size={16} />
            New session
          </Button>
        }
      />
      {state.hasLocal && (
        <Button disabled={state.busy} onClick={() => void state.importLocal()}>
          <Import size={16} />
          Import Lab session
        </Button>
      )}
      {state.status && <p role="status">{state.status}</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {state.sessions.length ? (
        <SessionList>
          {state.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onOpen={state.open}
              onRename={() => state.setFlow({ kind: 'rename', session })}
              onDelete={() => state.setFlow({ kind: 'delete', session })}
            />
          ))}
        </SessionList>
      ) : (
        <EmptyState title="No sessions yet" />
      )}
      <NameDialog
        open={state.flow?.kind === 'create'}
        title="New session"
        confirmLabel="Create"
        onSubmit={(name) => void state.create(name)}
        onCancel={() => state.setFlow(null)}
      />
      <NameDialog
        open={state.flow?.kind === 'rename'}
        title="Rename session"
        initialName={
          state.flow?.kind === 'rename' ? state.flow.session.name : ''
        }
        confirmLabel="Rename"
        onSubmit={(name) => {
          if (state.flow?.kind === 'rename')
            void state.rename(state.flow.session.id, name)
        }}
        onCancel={() => state.setFlow(null)}
      />
      <ConfirmDialog
        open={state.flow?.kind === 'delete'}
        title="Delete this session?"
        message={`Permanently delete "${state.flow?.kind === 'delete' ? state.flow.session.name : ''}" and all its clips and saved exports. This cannot be undone.`}
        confirmLabel="Delete session"
        onConfirm={() => {
          if (state.flow?.kind === 'delete')
            void state.remove(state.flow.session.id)
        }}
        onCancel={() => state.setFlow(null)}
      />
    </Stack>
  )
}
