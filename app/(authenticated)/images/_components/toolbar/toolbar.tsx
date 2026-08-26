'use client'

import {
  ArrowDown,
  ArrowUp,
  Download,
  FolderPlus,
  PanelRight,
  TextInitial,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import { ZOOM_STOPS } from '../../_hooks/use-prefs'
import styles from './toolbar.module.css'
import type { PrefsState } from '../../_hooks/use-prefs'
import type { ReactElement } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components'
import { cx } from '#/lib/utils'

/**
 * Every tool in this row is a bare glyph, and they are not all the same kind of
 * thing -- sort and captions change the view, the panel toggle shows the
 * generator. Identical-looking icons left that unsaid, so one read as another
 * show/hide switch.
 *
 * A label each, rather than fewer icons: all of them are used.
 */
function Labelled({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

interface ToolbarProps {
  prefs: PrefsState
  /** The generator panel. Its control stays put whichever way it is showing. */
  panelOpen: boolean
  onTogglePanel: () => void
  /** The group being worked in, or null at top level (#319). The name *and*
   *  the way back are a heading above the grid since #432; this row only needs
   *  to know whether it is inside one. */
  groupName?: string | null
  /** Download the open group as a zip (#477). Only ever passed inside one --
   *  the set it exports is what the grid is showing. */
  onDownloadGroup?: () => void
  /** Trash the open group. Only ever passed inside one -- see the control
   *  below (#431). */
  onTrashGroup?: () => void
  onNewGroup: () => void
}

export function Toolbar({
  prefs,
  panelOpen,
  onTogglePanel,
  groupName,
  onDownloadGroup,
  onTrashGroup,
  onNewGroup,
}: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {/* **No Upload button, and no file input behind one** (#491). Choosing a
          file from disk belongs to the library picker inside the generator
          panel (#489) -- where the image is about to be used -- and everything
          else arrives by paste, which uploads it and makes it the reference
          image in one gesture. A second route to the same thing, further from
          the work, is what was here.

          No page title either: the sidebar says which route this is, and
          "Images" above a grid of images said nothing. The group's name and the
          way back are an `<h1>` and a round button over the thumbnails (#432).
          The origin pills stood in this slot until #348. */}
      <div className={styles.scope}>
        {groupName ? (
          /* Inside a group, the acts that are about the group itself
             (#431, #477) -- both of them here because this is where you can
             see what they will apply to. */
          <>
            {/* Exporting the group you are standing in, for the same reason
                Trash group lives here: the contents are on screen. Left of
                Trash group so the harmless act is not the one that moves when
                the destructive one appears. */}
            {onDownloadGroup && (
              <button
                type="button"
                className={styles.downloadGroup}
                onClick={onDownloadGroup}
              >
                <Download className={styles.newGroupIcon} />
                Download
              </button>
            )}
            {/* **The one destructive act on a group, and it lives in here**
                (#431). It used to be a trash icon on the group card, in the
                same corner an image card carries one, in a grid that mixes the
                two -- so the click that bins a whole group was available from
                the one place you can see least about what it holds. Here you
                are looking at the contents when you press it. Labelled rather
                than a bare glyph for the same reason: the icon on its own is
                what was ambiguous. */}
            {onTrashGroup && (
              <button
                type="button"
                className={styles.trashGroup}
                onClick={onTrashGroup}
              >
                <Trash2 className={styles.newGroupIcon} />
                Trash group
              </button>
            )}
          </>
        ) : (
          /* An empty group is a legitimate way to start: name the thing you
             are about to work on, then generate into it. Without this the only
             way to make one is to have already made something, which is the
             wrong order for a place to work. */
          <button
            type="button"
            className={styles.newGroup}
            onClick={onNewGroup}
          >
            <FolderPlus className={styles.newGroupIcon} />
            New group
          </button>
        )}
      </div>
      <TooltipProvider delay={300}>
        <div className={styles.tools}>
          {/* Says what the click will do, not which way it is sorted now --
              the arrow already shows that. */}
          <Labelled
            label={prefs.sortAsc ? 'Sort newest first' : 'Sort oldest first'}
          >
            <button
              onClick={prefs.toggleSort}
              className={cx(styles.viewToggle, styles.viewToggleBoxed)}
              aria-label={
                prefs.sortAsc ? 'Sort newest first' : 'Sort oldest first'
              }
            >
              {prefs.sortAsc ? (
                <ArrowUp className={styles.icon} />
              ) : (
                <ArrowDown className={styles.icon} />
              )}
            </button>
          </Labelled>

          {/* Thumbnail size (#403). A flyout of the four stops, and the
              collapsed button shows only the icon -- what it is set to is
              visible in the grid behind it, so a number on the button would
              label the obvious and make the row's one variable-width control.
              The keyboard gesture is the fast path; this is the discoverable
              one. */}
          <DropdownMenu>
            {/* Opens on hover, so the stops are one gesture away rather than
                two. No tooltip, unlike its neighbours: a tooltip and a menu
                racing to occupy the same space under the same pointer is one
                of them always being wrong. The menu is the better answer --
                it says what the control does by showing what it offers. */}
            <DropdownMenuTrigger
              openOnHover
              delay={120}
              closeDelay={200}
              render={
                <button
                  type="button"
                  className={cx(styles.viewToggle, styles.viewToggleBoxed)}
                  aria-label="Thumbnail size"
                >
                  <ZoomIn className={styles.icon} />
                </button>
              }
            />
            {/* Centred under the glyph and only as wide as "100". The menu's
                own 8rem min-width is sized for labelled items; three digits
                left it mostly empty and pulled to one side. */}
            <DropdownMenuContent align="center" className={styles.zoomMenu}>
              {ZOOM_STOPS.map((stop) => (
                <DropdownMenuItem
                  key={stop}
                  onClick={() => prefs.setThumbZoom(stop)}
                  /* Marked in the text colour, never with a background: the
                     background is what hover means here, and a set value
                     wearing the hover fill reads as "the pointer is there"
                     rather than "this is the one". */
                  className={cx(prefs.thumbZoom === stop && styles.zoomCurrent)}
                >
                  {Math.round(stop * 100)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* "Captions", not "info": what it shows is the model name and the
              prompt under each card. */}
          <Labelled label={prefs.showInfo ? 'Hide captions' : 'Show captions'}>
            <button
              onClick={prefs.toggleInfo}
              className={cx(
                styles.viewToggle,
                prefs.showInfo && styles.viewToggleOn,
              )}
              aria-label={prefs.showInfo ? 'Hide captions' : 'Show captions'}
            >
              <TextInitial className={styles.icon} />
            </button>
          </Labelled>

          {/* The generator's own control, and it stays put: it used to be a
              green `+` that vanished once the panel was open, so opening it
              left only the panel's X and closing it moved the button back --
              two controls for one thing, neither of them where the other was.
              A panel toggle instead, in the row's own style, lit while the
              panel is showing the way select is. */}
          <Labelled label={panelOpen ? 'Hide generator' : 'Show generator'}>
            <button
              onClick={onTogglePanel}
              className={cx(styles.action, panelOpen && styles.actionOn)}
              aria-pressed={panelOpen}
              aria-label={panelOpen ? 'Hide generator' : 'Show generator'}
            >
              <PanelRight className={styles.icon} />
            </button>
          </Labelled>
        </div>
      </TooltipProvider>
    </div>
  )
}
