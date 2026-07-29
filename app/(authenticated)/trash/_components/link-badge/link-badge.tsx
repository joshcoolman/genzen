import { LayoutDashboard } from 'lucide-react'
import styles from './link-badge.module.css'
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '#/components'

/** Why a trashed image cannot be deleted: it is placed on the canvas. Being a
 *  generation's source used to be the other reason, and went with genealogy
 *  (#204). */
export function LinkBadge() {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge className={styles.canvas} />}>
        <LayoutDashboard />
        Canvas
      </TooltipTrigger>
      <TooltipContent>
        Used on Canvas -- remove from canvas first
      </TooltipContent>
    </Tooltip>
  )
}
