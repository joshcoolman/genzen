'use client'

import { Plus, X } from 'lucide-react'
import styles from './cut-tabs.module.css'
import type { StoredCut } from '../../../_lib/types'
import { cx } from '#/lib/utils'
import { ConfirmDialog, useConfirm } from '#/components'

/**
 * A run session's cuts, over the work area (#744).
 *
 * Inside Work rather than beside the session tabs: a cut is another version
 * of the run, while Characters, Locations and Storyboard are session-wide --
 * the cast is the same in every cut. Deleting a cut trashes its clips, so it
 * asks; the last cut offers no delete at all.
 */
export function CutTabs({
  cuts,
  active,
  busy,
  onOpen,
  onAdd,
  onDelete,
}: {
  cuts: Array<StoredCut>
  active: string
  busy: boolean
  onOpen: (cutId: string) => void
  onAdd: () => void
  onDelete: (cutId: string) => void
}) {
  const { confirm, dialogProps } = useConfirm()
  const askThenDelete = async (cut: StoredCut) => {
    const count = cut.clipIds.length
    const ok = await confirm({
      title: `Delete ${cut.name}?`,
      message:
        count === 0
          ? 'The cut has no clips.'
          : `Its ${count} ${count === 1 ? 'clip goes' : 'clips go'} to Trash.`,
      confirmLabel: 'Delete cut',
    })
    if (ok) onDelete(cut.id)
  }

  return (
    <nav className={styles.tabs} aria-label="Cuts">
      {cuts.map((cut) => (
        <span
          key={cut.id}
          className={cx(styles.tab, cut.id === active && styles.tabOn)}
        >
          <button
            type="button"
            className={styles.name}
            aria-current={cut.id === active ? 'page' : undefined}
            disabled={busy}
            onClick={() => onOpen(cut.id)}
          >
            {cut.name}
          </button>
          {cuts.length > 1 && (
            <button
              type="button"
              className={styles.close}
              aria-label={`Delete ${cut.name}`}
              disabled={busy}
              onClick={() => void askThenDelete(cut)}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        className={styles.add}
        disabled={busy}
        onClick={onAdd}
      >
        <Plus size={14} />
        New cut
      </button>
      <ConfirmDialog {...dialogProps} />
    </nav>
  )
}
