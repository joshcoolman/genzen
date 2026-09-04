'use client'

import {
  EyeOff,
  FolderMinus,
  FolderPlus,
  ScanSearch,
  Trash2,
} from 'lucide-react'
import {
  RailAction,
  RailActions,
} from '../../../_components/sidebar/rail-actions'
import { RailOverride } from '../../../_components/sidebar/rail-override'
import { Button, SelectionDrawer } from '#/components'

interface SelectionActionsProps {
  count: number
  busy: boolean
  /** Hide writes visibility rows of its own and can be busy on its own. */
  hideBusy: boolean
  onClear: () => void
  onAddToGroup: () => void
  /** Only inside a group: the selected clips return to top level. */
  onRemoveFromGroup?: () => void
  onHide: () => void
  onFocus: () => void
  onDelete: () => void
}

/**
 * Five verbs, against Images' seven. A still is a thing you file, sheet, zip
 * and share; a clip is a take you group, hide or prune. There is no reference
 * sheet -- a sheet of clips is not a thing -- and no zip in this pass (#517).
 * Hide and Focus arrived in #537: a wall of takes of one shot is mostly
 * near-misses you want out of the way while you judge the two that worked, and
 * trashing one to tidy up is a real loss.
 *
 * Two surfaces, one list: the rail on desktop, the drawer on mobile.
 */
export function SelectionActions({
  count,
  busy,
  hideBusy,
  onClear,
  onAddToGroup,
  onRemoveFromGroup,
  onHide,
  onFocus,
  onDelete,
}: SelectionActionsProps) {
  return (
    <>
      {count > 0 && (
        <RailOverride>
          <RailActions count={count} onClear={onClear}>
            <RailAction
              icon={FolderPlus}
              label="Add to group"
              caption="Group"
              disabled={busy}
              onClick={onAddToGroup}
            />
            {onRemoveFromGroup && (
              <RailAction
                icon={FolderMinus}
                label="Remove from group"
                caption="Ungroup"
                disabled={busy}
                onClick={onRemoveFromGroup}
              />
            )}
            <RailAction
              icon={EyeOff}
              label="Hide"
              caption="Hide"
              disabled={busy || hideBusy}
              onClick={onHide}
            />
            <RailAction
              icon={ScanSearch}
              label="Focus"
              caption="Focus"
              disabled={busy}
              onClick={onFocus}
            />
            <RailAction
              icon={Trash2}
              label={busy ? 'Trashing...' : `Trash ${count}`}
              caption="Trash"
              count={count}
              busy={busy}
              onClick={onDelete}
            />
          </RailActions>
        </RailOverride>
      )}
      <SelectionDrawer count={count} onClear={onClear}>
        <Button
          variant="secondary"
          size="sm"
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
            size="sm"
            disabled={busy}
            onClick={onRemoveFromGroup}
          >
            <FolderMinus size={14} />
            Remove from group
          </Button>
        )}
        {/* Hide and Focus are a pair and stay one (#537): Focus shows only the
            selection, Hide removes only it, and neither destroys anything.
            They sit before Trash, which is the only verb here that does. */}
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || hideBusy}
          onClick={onHide}
        >
          <EyeOff size={14} />
          Hide
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={onFocus}>
          <ScanSearch size={14} />
          Focus
        </Button>
        {/* Not `danger` and not "Delete": this moves rows to Trash, where they
            sit until it is emptied -- red belongs to Delete Forever. */}
        <Button size="sm" disabled={busy} onClick={onDelete}>
          <Trash2 size={14} />
          {busy ? 'Trashing...' : `Trash ${count}`}
        </Button>
      </SelectionDrawer>
    </>
  )
}
