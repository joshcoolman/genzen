'use client'

import { useRef } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  FolderPlus,
  Info,
  PanelRight,
  Upload,
} from 'lucide-react'
import { ORIGIN_FILTERS, ORIGIN_FILTER_LABELS } from '../../_hooks/use-prefs'
import styles from './toolbar.module.css'
import type { PrefsState } from '../../_hooks/use-prefs'
import type { ReactElement } from 'react'
import {
  SingleSelect,
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
  groupName,
  onLeaveGroup,
  onNewGroup,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={styles.toolbar}>
      <div className={styles.scope}>
        {/* Inside a group the pills are gone, not disabled (#319). A group is
            already the scope, and two scoping controls stacked on each other
            invite the question of which one wins -- with the honest answer
            being that origin filtering has almost no use once things that
            belong together are together. The chevron takes their place; it is
            the same navigation the browser's Back button performs, since the
            group is in the URL. */}
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
          <>
            {/* No page title: the sidebar says which route this is, the pills
                say what is scoped, and "Images" above a grid of images said
                neither. */}
            <SingleSelect
              options={ORIGIN_FILTERS.map((value) => ({
                value,
                label: ORIGIN_FILTER_LABELS[value],
              }))}
              value={prefs.originFilter}
              // SingleSelect clears on re-click; here "no scope" is `all`, so a
              // second click on the active pill widens rather than doing
              // nothing.
              onChange={(value) => prefs.setOriginFilter(value ?? 'all')}
            />
            {/* An empty group is a legitimate way to start: name the thing you
                are about to work on, then generate into it. Without this the
                only way to make one is to have already made something, which
                is the wrong order for a place to work. */}
            <button
              type="button"
              className={styles.newGroup}
              onClick={onNewGroup}
            >
              <FolderPlus className={styles.newGroupIcon} />
              New group
            </button>
          </>
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
          <Labelled label="Upload images">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={styles.action}
              aria-label="Upload images"
            >
              <Upload className={styles.icon} />
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
