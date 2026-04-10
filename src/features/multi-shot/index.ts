// Minimal residual exports from the old multi-shot feature.
// The user-facing flow has been merged into the ai-video feature with
// unified parent/child grouping; only the FAL model constant and the
// ShotCard UI component remain here for reuse.

export { MULTISHOT_FAL_MODEL } from './types'
export type { Shot, MultiShotElement } from './types'
export { ShotCard } from './components/ShotCard'
