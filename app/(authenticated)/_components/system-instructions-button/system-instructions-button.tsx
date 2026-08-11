'use client'

import { Settings2 } from 'lucide-react'
import styles from './system-instructions-button.module.css'
import { Popover, PopoverContent, PopoverTrigger, Textarea } from '#/components'
import { useSystemInstructions } from '#/features/ai-images/hooks/use-system-instructions'
import { cx } from '#/lib/utils'

/**
 * The gear above the prompt list (#272): a popover holding the one block of
 * instructions prepended to every prompt sent to FAL.
 *
 * It sits in `GeneratorPanel` rather than the Images dock header because Canvas
 * renders the same panel and has no such header -- the gear would have existed
 * on one route while the prefix silently applied to both.
 *
 * The dot is the whole safety mechanism. Hidden and persistent is the point;
 * hidden, persistent and unmarked is a paragraph typed on Tuesday quietly
 * editing Friday's generations.
 */
export function SystemInstructionsButton() {
  const { value, setValue, isSet } = useSystemInstructions()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cx(styles.trigger, isSet && styles.triggerSet)}
            title={isSet ? 'System instructions (set)' : 'System instructions'}
            aria-label="System instructions"
          >
            <Settings2 className={styles.icon} />
            Instructions
          </button>
        }
      />
      <PopoverContent align="end" side="bottom" className={styles.popover}>
        <p className={styles.title}>System instructions</p>
        <p className={styles.subtitle}>
          Optional instructions prepended to every image request.
        </p>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          placeholder="e.g. Inventory the reference image and freeze everything but the camera."
          className={styles.textarea}
        />
      </PopoverContent>
    </Popover>
  )
}
