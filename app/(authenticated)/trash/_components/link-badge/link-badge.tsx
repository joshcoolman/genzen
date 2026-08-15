import { LayoutDashboard } from 'lucide-react'
import styles from './link-badge.module.css'
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '#/components'

/** This image still holds its canvas membership, so restoring it puts the card
 *  back where it sat. It used to mean the row could not be deleted at all,
 *  which deadlocked every image ever deleted from a canvas (#371). */
export function LinkBadge() {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge className={styles.canvas} />}>
        <LayoutDashboard />
        Canvas
      </TooltipTrigger>
      <TooltipContent>Restoring this puts it back on the canvas</TooltipContent>
    </Tooltip>
  )
}
