'use client'

import { Plus } from 'lucide-react'
import { CanvasCard } from './_components/canvas-card/canvas-card'
import { useView } from './use-view'
import type { CanvasSummary } from './_actions/canvases'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ImageGrid,
  NameDialog,
  PageHeader,
  Stack,
} from '#/components'

export function View({ initial }: { initial: Array<CanvasSummary> }) {
  const {
    canvases,
    flow,
    busy,
    setFlow,
    closeFlow,
    open,
    create,
    rename,
    remove,
  } = useView(initial)

  return (
    <Stack gap={24}>
      <PageHeader
        title="Canvas"
        description={`${canvases.length} ${canvases.length === 1 ? 'canvas' : 'canvases'}`}
        aside={
          <Button
            size="sm"
            disabled={busy}
            onClick={() => setFlow({ kind: 'create' })}
          >
            <Plus />
            New canvas
          </Button>
        }
      />

      {canvases.length === 0 ? (
        <EmptyState title="No canvases yet">
          A canvas is a board you arrange images on -- pasted, uploaded, picked
          from your library, or generated right there. Make one and it is yours
          to fill.
        </EmptyState>
      ) : (
        <ImageGrid size="md">
          {canvases.map((canvas) => (
            <CanvasCard
              key={canvas.id}
              canvas={canvas}
              onOpen={open}
              onRename={(c) => setFlow({ kind: 'rename', canvas: c })}
              onDelete={(c) => setFlow({ kind: 'confirm-delete', canvas: c })}
            />
          ))}
        </ImageGrid>
      )}

      <NameDialog
        open={flow?.kind === 'create'}
        title="New canvas"
        confirmLabel="Create"
        onSubmit={(name) => void create(name)}
        onCancel={closeFlow}
      />

      <NameDialog
        open={flow?.kind === 'rename'}
        title="Rename canvas"
        initialName={flow?.kind === 'rename' ? flow.canvas.name : ''}
        confirmLabel="Rename"
        onSubmit={(name) => {
          if (flow?.kind !== 'rename') return
          void rename(flow.canvas.id, name)
        }}
        onCancel={closeFlow}
      />

      {/* What this destroys is said plainly, because the word "delete" beside a
          grid of pictures reads as if it takes them with it. It does not: the
          arrangement goes and every image stays in the library. */}
      <ConfirmDialog
        open={flow?.kind === 'confirm-delete'}
        title="Delete this canvas?"
        message={
          flow?.kind !== 'confirm-delete'
            ? ''
            : flow.canvas.count === 0
              ? `“${flow.canvas.name}” will be deleted. There is nothing on it.`
              : `“${flow.canvas.name}” and its arrangement will be deleted. The ${flow.canvas.count} ${flow.canvas.count === 1 ? 'image' : 'images'} on it stay in your library.`
        }
        confirmLabel="Delete canvas"
        onConfirm={() => {
          if (flow?.kind !== 'confirm-delete') return
          void remove(flow.canvas.id)
        }}
        onCancel={closeFlow}
      />
    </Stack>
  )
}
