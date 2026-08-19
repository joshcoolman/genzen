'use client'

import { Settings } from 'lucide-react'
import styles from './canvas-settings.module.css'
import type { CanvasPrefsState } from '../../_hooks/use-canvas-prefs'
import { Popover, PopoverContent, PopoverTrigger, Switch } from '#/components'

interface CanvasSettingsProps {
  prefs: CanvasPrefsState
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The canvas's own settings, in the bottom bar beside Upload and Library --
 * canvas-level controls, not selection actions, which is why they sit left of
 * the first divider.
 *
 * A popover rather than a `Dialog` (#394): this is a two-line panel, and dimming
 * the board to toggle a label is the wrong weight for it.
 *
 * `open` is lifted because the canvas has to stand its hotkeys down while the
 * panel is up -- `use-canvas-hotkeys` reads `dialogOpenRef`, and without that
 * Space still pans and Backspace still removes the selection underneath.
 */
export function CanvasSettings({
  prefs,
  open,
  onOpenChange,
}: CanvasSettingsProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={styles.trigger}
        aria-label="Canvas settings"
        title="Canvas settings"
      >
        <Settings size={18} />
      </PopoverTrigger>
      <PopoverContent className={styles.panel} side="top" align="start">
        <label className={styles.row}>
          <span className={styles.label}>Show model labels</span>
          <Switch
            checked={prefs.showModelLabels}
            onCheckedChange={(checked) => prefs.setShowModelLabels(checked)}
          />
        </label>
      </PopoverContent>
    </Popover>
  )
}
