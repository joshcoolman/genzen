'use client'

import { Plus } from 'lucide-react'
import styles from './group-picker-dialog.module.css'
import type { ImageGroupSummary } from '../../_hooks/use-groups'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components'

interface GroupPickerDialogProps {
  open: boolean
  groups: Array<ImageGroupSummary>
  /** How many images are being filed, for the title. */
  count: number
  onPick: (groupId: string) => void
  onNewGroup: () => void
  onCancel: () => void
}

/**
 * Where do these go? (#319)
 *
 * A dialog rather than a submenu off the `...` menu, and that is the whole
 * point of it: a flyout of group names commits you to picking one at the exact
 * moment you are most likely to realise the group you wanted does not exist
 * yet. This has a Cancel, and `New group...` in the same list, so noticing that
 * mid-gesture costs nothing.
 *
 * Never opened with an empty list -- the caller sends you straight to the name
 * dialog instead, because "pick from nothing, or make one" is not a choice.
 */
export function GroupPickerDialog({
  open,
  groups,
  count,
  onPick,
  onNewGroup,
  onCancel,
}: GroupPickerDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Add to group</DialogTitle>
          <DialogDescription>
            {count === 1 ? '1 image' : `${count} images`}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.list}>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={styles.row}
              onClick={() => onPick(group.id)}
            >
              <span className={styles.name}>{group.name}</span>
              <span className={styles.count}>{group.count}</span>
            </button>
          ))}

          <button type="button" className={styles.newRow} onClick={onNewGroup}>
            <Plus className={styles.newIcon} />
            New group...
          </button>
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
