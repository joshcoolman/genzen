'use client'

import { Settings2 } from 'lucide-react'
import styles from './system-instructions-button.module.css'
import {
  MiniButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from '#/components'
import { useSystemInstructions } from '#/features/ai-images/hooks/use-system-instructions'

/**
 * The gear on the generator's header (#272): a popover holding the one block of
 * instructions prepended to every prompt sent to FAL.
 *
 * Icon-only. The label said "Instructions", which is the widest thing that was
 * ever going to sit in a 20rem panel's header, and a gear beside a title is
 * already the universal reading.
 *
 * **Every surface that renders `GeneratorPanel` must also render this**, and
 * there are three: the Images dock (desktop and mobile) and the Canvas dialog.
 * It used to live inside the panel for exactly that reason. It moved out when
 * the header became its home, so the rule that was structural is now a rule you
 * have to keep -- the failure it guards against is the gear existing on one
 * route while the prefix silently applies to all of them.
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
          <MiniButton
            icon={<Settings2 />}
            indicator={isSet}
            title={isSet ? 'System instructions (set)' : 'System instructions'}
            aria-label="System instructions"
          />
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
