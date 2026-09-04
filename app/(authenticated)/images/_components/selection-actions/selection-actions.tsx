'use client'

import {
  Download,
  EyeOff,
  FolderMinus,
  FolderPlus,
  LayoutGrid,
  ScanSearch,
  Trash2,
} from 'lucide-react'
import {
  RailAction,
  RailActions,
} from '../../../_components/sidebar/rail-actions'
import { RailOverride } from '../../../_components/sidebar/rail-override'
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
  /** Composite the selection into one downloadable sheet (#476). */
  onCreateReferenceSheet: () => void
  /** The sheet is built on the server and can take a while; the rest of the
   *  drawer stays live while it does. */
  sheetBusy: boolean
  /** Take the selection out of the grid without destroying it (#504). */
  onHide: () => void
  /** Show only the selection (#504). The same filtered view from the other
   *  end -- nothing is written, and the strip under the grid is the way out. */
  onFocus: () => void
  /** Zip exactly these images (#480) -- opens the same dialog the group page
   *  uses, handed the selection instead of the group. */
  onDownloadZip: () => void
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
  onCreateReferenceSheet,
  sheetBusy,
  onHide,
  onFocus,
  onDownloadZip,
}: SelectionActionsProps) {
  return (
    <>
      {/* Two surfaces, one list of verbs. The rail is desktop, the drawer is
          mobile, and which one you see is CSS at 48rem -- the rail is hidden
          below it and the drawer above it. */}
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
              icon={LayoutGrid}
              label="Create reference sheet"
              caption="Sheet"
              disabled={busy}
              busy={sheetBusy}
              onClick={onCreateReferenceSheet}
            />
            <RailAction
              icon={Download}
              label="Download zip"
              caption="Zip"
              disabled={busy}
              onClick={onDownloadZip}
            />
            <RailAction
              icon={ScanSearch}
              label="Focus"
              caption="Focus"
              disabled={busy}
              onClick={onFocus}
            />
            <RailAction
              icon={EyeOff}
              label={`Hide ${count}`}
              caption="Hide"
              count={count}
              disabled={busy}
              onClick={onHide}
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
        {/* **A selection action, not a group feature** (#476). Groups are only
          one place a selection happens, so this sits beside Add to group
          rather than on the group page -- which is also what means there is no
          mode to enter, and no question about what it does with nothing
          picked. It downloads; nothing is stored. */}
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          loading={sheetBusy}
          onClick={onCreateReferenceSheet}
        >
          {!sheetBusy && <LayoutGrid className={styles.icon} />}
          {sheetBusy ? 'Building sheet...' : 'Create reference sheet'}
        </Button>
        {/* The group page keeps its own Download, because wanting a whole group
          without picking through it is the common case. This is the other
          scope: exactly what is selected, wherever it came from (#480). */}
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={onDownloadZip}
        >
          <Download className={styles.icon} />
          Download zip
        </Button>
        {/* The pair that narrow what is on screen (#504), from opposite ends:
          Focus shows only these, Hide removes only these. Neither destroys
          anything, which is why they sit among the ordinary verbs and not
          beside Trash.

          Focus first, because it is the one that turned out to be the real
          gesture -- wanting to look at two images rather than to get rid of
          eight. */}
        <Button variant="secondary" size="sm" disabled={busy} onClick={onFocus}>
          <ScanSearch className={styles.icon} />
          Focus
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={onHide}>
          <EyeOff className={styles.icon} />
          {`Hide ${count}`}
        </Button>
        {/* Not `danger`, and not "Delete": this moves rows to Trash, where they
          sit until you empty it. Red belongs to the one verb that cannot be
          undone, which is Trash's own Delete Forever. */}
        <Button size="sm" disabled={busy} onClick={onDelete}>
          <Trash2 className={styles.icon} />
          {busy ? 'Trashing...' : `Trash ${count}`}
        </Button>
      </SelectionDrawer>
    </>
  )
}
