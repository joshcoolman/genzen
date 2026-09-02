'use client'

import { Plus } from 'lucide-react'
import styles from './group-picker-dialog.module.css'
import type { ImageGroupSummary } from '#/features/groups/hooks/use-groups'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components'
import { imageUrl } from '#/lib/image-url'

interface GroupPickerDialogProps {
  open: boolean
  groups: Array<ImageGroupSummary>
  /** How many images are being filed, for the title. */
  count: number
  /** Defaults to the filing case. Moving a whole group's contents (#350) is
   *  the same question asked about a different noun, so it borrows the dialog
   *  rather than growing a second one. */
  title?: string
  description?: string
  onPick: (groupId: string) => void
  /** Absent hides the `New group...` row. A move has no use for it: sending a
   *  group's contents to a group that does not exist yet is a rename. */
  onNewGroup?: () => void
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
 *
 * **App-shared since #517**, when Video grew groups: the rows are a cover, a
 * name and a count, and a clip's cover is an `<img>` from `thumbnail_path`
 * exactly as a picture's is, so there was nothing on it to make route-specific.
 * `description` is the one thing that says which noun is being filed, and it
 * is already a prop.
 */
export function GroupPickerDialog({
  open,
  groups,
  count,
  title = 'Add to group',
  description,
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? (count === 1 ? '1 image' : `${count} images`)}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.list}>
          {groups.map((group) => {
            // The same cover the card in the grid shows -- frozen if there is
            // one, newest member otherwise -- so a row here and the tile it
            // stands for are recognisably the same thing. An empty group has
            // no picture and gets the ghosted slot the card's strip uses,
            // which keeps every name on the same left edge.
            const coverId = group.cover_image_id ?? group.preview_image_ids[0]
            return (
              <button
                key={group.id}
                type="button"
                className={styles.row}
                onClick={() => onPick(group.id)}
              >
                <span
                  className={coverId ? styles.cover : styles.coverEmpty}
                  style={
                    coverId
                      ? {
                          backgroundImage: `url(${imageUrl(coverId, 'thumb')})`,
                        }
                      : undefined
                  }
                  aria-hidden="true"
                />
                <span className={styles.name}>{group.name}</span>
                <span className={styles.count}>{group.count}</span>
              </button>
            )
          })}

          {onNewGroup && (
            <button
              type="button"
              className={styles.newRow}
              onClick={onNewGroup}
            >
              <Plus className={styles.newIcon} />
              New group...
            </button>
          )}
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
