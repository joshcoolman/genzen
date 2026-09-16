'use client'

import { MessageSquare, Plus } from 'lucide-react'
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

export function View({ initial }: { initial: Array<SessionSummary> }) {
  const state = useView(initial)
  return (
    <Stack gap={24}>
      <PageHeader
        title="Director"
        description={`${state.sessions.length} sessions`}
        aside={
          <Stack direction="row" gap={8}>
            {/* A chat is a kind of session, chosen at birth (#670): a
                question box instead of Add clips, a character instead of a
                prompt. It opens at once, unnamed -- the model names it from
                the first question, so nothing stands between you and
                asking it. */}
            <Button
              disabled={state.busy}
              onClick={() => void state.createChat()}
            >
              <MessageSquare size={16} />
              New chat
            </Button>
            <Button
              disabled={state.busy}
              onClick={() => state.setFlow({ kind: 'create' })}
            >
              <Plus size={16} />
              New session
            </Button>
          </Stack>
        }
      />
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
        /* A session's clips go with it (#679): they are shown nowhere else,
           so they go to Trash, where any of them can be restored. */
        message={`Delete "${state.flow?.kind === 'delete' ? state.flow.session.name : ''}"? Its clips go to Trash.`}
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
