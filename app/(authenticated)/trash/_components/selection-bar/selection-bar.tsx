'use client'

import { RotateCcw, Trash2 } from 'lucide-react'
import {
  RailAction,
  RailActions,
} from '../../../_components/sidebar/rail-actions'
import { RailOverride } from '../../../_components/sidebar/rail-override'
import styles from './selection-bar.module.css'
import {
  Button,
  ConfirmDialog,
  SelectionDrawer,
  useConfirm,
} from '#/components'

interface SelectionBarProps {
  count: number
  busy: boolean
  onClear: () => void
  onRestore: () => void
  onDelete: () => void
}

export function SelectionBar({
  count,
  busy,
  onClear,
  onRestore,
  onDelete,
}: SelectionBarProps) {
  const { confirm, dialogProps } = useConfirm()
  const noun = count === 1 ? 'item' : 'items'

  async function ask() {
    const ok = await confirm({
      title: `Delete ${count} ${noun}?`,
      message: `This will permanently delete ${count} ${noun} and their files. Linked items will be skipped. This action cannot be undone.`,
      confirmLabel: 'Delete Forever',
    })
    if (ok) onDelete()
  }

  return (
    <>
      {/* Desktop: the rail. Mobile: the drawer below. Delete keeps its confirm
          on both -- it is the one verb in the app that cannot be undone. */}
      {count > 0 && (
        <RailOverride>
          <RailActions count={count} onClear={onClear}>
            <RailAction
              icon={RotateCcw}
              label={`Restore (${count})`}
              caption="Restore"
              count={count}
              disabled={busy}
              onClick={onRestore}
            />
            <RailAction
              icon={Trash2}
              label={`Delete (${count})`}
              caption="Delete"
              count={count}
              danger
              disabled={busy}
              onClick={() => void ask()}
            />
          </RailActions>
        </RailOverride>
      )}
      <SelectionDrawer count={count} onClear={onClear}>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>
          <RotateCcw className={styles.icon} />
          Restore ({count})
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={() => void ask()}
        >
          <Trash2 className={styles.icon} />
          Delete ({count})
        </Button>
      </SelectionDrawer>
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
