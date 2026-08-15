import { LayoutDashboard } from 'lucide-react'
import styles from './link-badge.module.css'
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '#/components'

/** Still on a canvas. Trashing does not take a card off the board (#375), so
 *  this image is visible there right now -- which is why it cannot be deleted
 *  from here. Remove it from the canvas and the lock lifts. */
export function LinkBadge() {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge className={styles.canvas} />}>
        <LayoutDashboard />
        Canvas
      </TooltipTrigger>
      <TooltipContent>
        Still on the canvas -- remove it there to delete it
      </TooltipContent>
    </Tooltip>
  )
}
