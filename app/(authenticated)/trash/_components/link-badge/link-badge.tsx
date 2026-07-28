import { LayoutDashboard, Link2 } from 'lucide-react'
import styles from './link-badge.module.css'
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '#/components'

/** Why a trashed image cannot be deleted. `canvas` is a placement on the
 *  canvas; `linked` is `dependents` living images that still point at it. The
 *  two are exclusive -- canvas wins, because it is the one the user can undo. */
export type LinkKind = 'canvas' | 'linked'

interface LinkBadgeProps {
  kind: LinkKind
  dependents: number
}

export function LinkBadge({ kind, dependents }: LinkBadgeProps) {
  const isCanvas = kind === 'canvas'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={isCanvas ? styles.canvas : styles.linked}
        >
          {isCanvas ? <LayoutDashboard /> : <Link2 />}
          {isCanvas ? 'Canvas' : 'Linked'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {isCanvas
          ? 'Used on Canvas -- remove from canvas first'
          : `Used by ${dependents} active ${dependents === 1 ? 'image' : 'images'} -- restore or delete dependents first`}
      </TooltipContent>
    </Tooltip>
  )
}
