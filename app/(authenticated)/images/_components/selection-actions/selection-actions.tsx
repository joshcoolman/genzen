'use client'

import { FolderMinus, FolderPlus, Trash2 } from 'lucide-react'
import styles from './selection-actions.module.css'
import { Button, SelectionDrawer } from '#/components'

interface SelectionActionsProps {
  count: number
  busy: boolean
  onClear: () => void
  onDelete: () => void
  /** Groups (#319). Opens the picker, or the name dialog when there are no
   *  groups yet -- creating and adding are one command. */
  onAddToGroup: () => void
  /** Only inside a group: the selected images return to top level. */
  onRemoveFromGroup?: () => void
}

/**
 * The drawer that rises once anything in the gallery is selected.
 *
 * Grouping adds a verb here rather than a surface of its own -- select mode,
 * this drawer and the card's `...` menu already exist, and #319's whole
 * constraint is that a group changes nothing about the app except which images
 * are visible and where new ones land.
 */
export function SelectionActions({
  count,
  busy,
  onClear,
  onDelete,
  onAddToGroup,
  onRemoveFromGroup,
}: SelectionActionsProps) {
  return (
    <SelectionDrawer count={count} onClear={onClear}>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={onAddToGroup}
      >
        <FolderPlus className={styles.icon} />
        Add to group
      </Button>
      {onRemoveFromGroup && (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={onRemoveFromGroup}
        >
          {/* The mirror of Add to group, and it should look like one: a folder
              losing an item, not a broken link. */}
          <FolderMinus className={styles.icon} />
          Remove from group
        </Button>
      )}
      {/* Not `danger`, and not "Delete": this moves rows to Trash, where they
          sit until you empty it. Red belongs to the one verb that cannot be
          undone, which is Trash's own Delete Forever. */}
      <Button size="sm" disabled={busy} onClick={onDelete}>
        <Trash2 className={styles.icon} />
        {busy ? 'Trashing...' : `Trash ${count}`}
      </Button>
    </SelectionDrawer>
  )
}
