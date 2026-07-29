import { LayoutDashboard, Link2 } from 'lucide-react'
import styles from './link-badge.module.css'
// Deep imports for the same reason as download-dialog: the shadcn `Badge` and
// `Tooltip` still hold those names in the root barrel for the rest of the app.
import { Badge } from '#/components/badge/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/tooltip/tooltip'

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
      <TooltipTrigger
        render={<Badge className={isCanvas ? styles.canvas : styles.linked} />}
      >
        {isCanvas ? <LayoutDashboard /> : <Link2 />}
        {isCanvas ? 'Canvas' : 'Linked'}
      </TooltipTrigger>
      <TooltipContent>
        {isCanvas
          ? 'Used on Canvas -- remove from canvas first'
          : `Used by ${dependents} active ${dependents === 1 ? 'image' : 'images'} -- restore or delete dependents first`}
      </TooltipContent>
    </Tooltip>
  )
}
