'use client'

import { Plus } from 'lucide-react'
import { EditCard } from './_components/edit-card/edit-card'
import { EditList } from './_components/edit-list/edit-list'
import { useView } from './use-view'
import type { EditSummary } from './_lib/types'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  NameDialog,
  PageHeader,
  Stack,
} from '#/components'

export function View({ initial }: { initial: Array<EditSummary> }) {
  const state = useView(initial)
  return (
    <Stack gap={24}>
      <PageHeader
        title="Edit"
        description={`${state.edits.length} edits`}
        aside={
          <Button
            disabled={state.busy}
            onClick={() => state.setFlow({ kind: 'create' })}
          >
            <Plus size={16} />
            New edit
          </Button>
        }
      />
      {state.error && <p role="alert">{state.error}</p>}
      {state.edits.length ? (
        <EditList>
          {state.edits.map((edit) => (
            <EditCard
              key={edit.id}
              edit={edit}
              onOpen={state.open}
              onRename={() => state.setFlow({ kind: 'rename', edit })}
              onDelete={() => state.setFlow({ kind: 'delete', edit })}
            />
          ))}
        </EditList>
      ) : (
        <EmptyState title="No edits yet" />
      )}
      <NameDialog
        open={state.flow?.kind === 'create'}
        title="New edit"
        confirmLabel="Create"
        onSubmit={(name) => void state.create(name)}
        onCancel={() => state.setFlow(null)}
      />
      <NameDialog
        open={state.flow?.kind === 'rename'}
        title="Rename edit"
        initialName={state.flow?.kind === 'rename' ? state.flow.edit.name : ''}
        confirmLabel="Rename"
        onSubmit={(name) => {
          if (state.flow?.kind === 'rename')
            void state.rename(state.flow.edit.id, name)
        }}
        onCancel={() => state.setFlow(null)}
      />
      <ConfirmDialog
        open={state.flow?.kind === 'delete'}
        title="Delete this edit?"
        /* The clips are Video's and stay on the wall. */
        message={`Delete "${state.flow?.kind === 'delete' ? state.flow.edit.name : ''}"? Its clips stay on the Video wall.`}
        confirmLabel="Delete edit"
        onConfirm={() => {
          if (state.flow?.kind === 'delete')
            void state.remove(state.flow.edit.id)
        }}
        onCancel={() => state.setFlow(null)}
      />
    </Stack>
  )
}
