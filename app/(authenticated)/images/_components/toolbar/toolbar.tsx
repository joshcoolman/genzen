'use client'

import { useRef } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  FolderInput,
  FolderPlus,
  Info,
  PanelRight,
  Search,
  Upload,
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
 * thing -- sort and captions change the view, select changes what a click
 * means, upload and generate do something once. Four identical-looking icons
 * left that unsaid, so select read as another show/hide switch.
 *
 * A label each, rather than fewer icons: all five are used.
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
  onUpload: (files: Array<File>) => void
  /**
   * Open the destination picker for an upload (#348). Absent when there is
   * nothing to pick from, which is what collapses the menu to a plain button.
   */
  onUploadToGroup?: () => void
  /** The group being worked in, or null at top level (#319). */
  groupName?: string | null
  onLeaveGroup: () => void
  onNewGroup: () => void
}

export function Toolbar({
  prefs,
  panelOpen,
  onTogglePanel,
  onUpload,
  onUploadToGroup,
  groupName,
  onLeaveGroup,
  onNewGroup,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openFilePicker = () => fileInputRef.current?.click()

  return (
    <div className={styles.toolbar}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className={styles.fileInput}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onUpload(files)
          e.target.value = ''
        }}
      />
      {/* Upload is the leftmost control in both states, so its position never
          moves. Inside a group the chevron follows it -- that is the same
          navigation the browser's Back button performs, since the group is in
          the URL.

          No page title: the sidebar says which route this is, and "Images"
          above a grid of images said nothing. The origin pills stood here
          until #348 -- a group is a scope you made on purpose, and it turned
          out to be the only one worth having. */}
      <div className={styles.scope}>
        {/* The menu is top level only. Inside a group Upload goes straight to
            the file picker and the files land in the open group: a group is a
            focus session, and asking which group you meant while you are
            standing in one is ceremony. A deliberate exception to "one way to
            do things" -- and the only one, since `onUploadToGroup` is also
            absent when there are no groups to pick from. */}
        {onUploadToGroup ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type="button" className={styles.upload}>
                  <Upload className={styles.uploadIcon} />
                  Upload
                </button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={openFilePicker}>
                <Upload />
                Upload
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUploadToGroup}>
                <FolderInput />
                Upload to group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            className={styles.upload}
            onClick={openFilePicker}
          >
            <Upload className={styles.uploadIcon} />
            Upload
          </button>
        )}

        {groupName ? (
          <button
            type="button"
            className={styles.crumb}
            onClick={onLeaveGroup}
            aria-label="Leave group"
          >
            <ChevronLeft className={styles.crumbIcon} />
            <span className={styles.crumbName}>{groupName}</span>
          </button>
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
              className={styles.viewToggle}
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
              <Info className={styles.icon} />
            </button>
          </Labelled>

          {/* Thumbnail size (#403). A flyout of the four stops, and the
              collapsed button shows only the icon -- what it is set to is
              visible in the grid behind it, so a number on the button would
              label the obvious and make the row's one variable-width control.
              The keyboard gesture is the fast path; this is the discoverable
              one. */}
          <DropdownMenu>
            <Labelled label="Thumbnail size">
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={styles.viewToggle}
                    aria-label="Thumbnail size"
                  >
                    <Search className={styles.icon} />
                  </button>
                }
              />
            </Labelled>
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
