'use client'

import { EyeOff, FolderMinus, FolderPlus, Trash2 } from 'lucide-react'
import { SelectionPanel } from '../../../_components/selection-panel/selection-panel'
import { Button, SelectionDrawer } from '#/components'

interface SelectionActionsProps {
  /** Which surface renders the verbs: the controls column, or the bottom
   *  drawer when the column has stacked under the wall (#587). */
  surface: 'panel' | 'drawer'
  count: number
  busy: boolean
  /** Hide writes visibility rows of its own and can be busy on its own. */
  hideBusy: boolean
  onClear: () => void
  onAddToGroup: () => void
  /** Only inside a group: the selected clips return to top level. */
  onRemoveFromGroup?: () => void
  onHide: () => void
  onDelete: () => void
}

/**
 * Four verbs, against Images' six. A still is a thing you file, sheet and
 * share; a clip is a take you group, hide or prune. There is no reference
 * sheet -- a sheet of clips is not a thing -- and no zip in this pass (#517).
 * Hide arrived in #537: a wall of takes of one shot is mostly near-misses you
 * want out of the way while you judge the two that worked, and trashing one to
 * tidy up is a real loss.
 *
 * One list, two containers: the controls column on a wide screen, the bottom
 * drawer once that column has stacked under the wall.
 */
export function SelectionActions({
  surface,
  count,
  busy,
  hideBusy,
  onClear,
  onAddToGroup,
  onRemoveFromGroup,
  onHide,
  onDelete,
}: SelectionActionsProps) {
  /* The column has room the bar never did, and a row you are meant to read
     down wants to be a row rather than a chip. */
  const size = surface === 'panel' ? 'md' : 'sm'

  const verbs = (
    <>
      <Button
        variant="secondary"
        size={size}
        disabled={busy}
        onClick={onAddToGroup}
      >
        <FolderPlus size={14} />
        Add to group
      </Button>
      {/* Only inside a group: the mirror of Add to group, and it should look
          like one -- a folder losing an item, not a broken link. */}
      {onRemoveFromGroup && (
        <Button
          variant="secondary"
          size={size}
          disabled={busy}
          onClick={onRemoveFromGroup}
        >
          <FolderMinus size={14} />
          Remove from group
        </Button>
      )}
      {/* Hide removes the selection from the wall without destroying it
          (#537), so it sits before Trash, which is the only verb here that
          does. */}
      <Button
        variant="secondary"
        size={size}
        disabled={busy || hideBusy}
        onClick={onHide}
      >
        <EyeOff size={14} />
        Hide
      </Button>
      {/* Not `danger` and not "Delete": this moves rows to Trash, where they
          sit until it is emptied -- red belongs to Delete Forever. */}
      <Button size={size} disabled={busy} onClick={onDelete}>
        <Trash2 size={14} />
        {busy ? 'Trashing...' : `Trash ${count}`}
      </Button>
    </>
  )

  if (surface === 'panel') {
    return (
      <SelectionPanel count={count} onClear={onClear}>
        {verbs}
      </SelectionPanel>
    )
  }

  return (
    <SelectionDrawer count={count} onClear={onClear}>
      {verbs}
    </SelectionDrawer>
  )
}
