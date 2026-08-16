export type ModelCapability = 'generate' | 'edit' | 'sidebar' | 'video'
export type SelectionMode = 'single' | 'multi'

export interface UnifiedModel {
  id: string
  name: string
  description: string
  capability: ModelCapability
  editId?: string
  maxRefImages?: number
  /** Dollars per image. A number so the picker can align and sort it (#341). */
  price?: number
  /**
   * Images this model's endpoint holds -- `imageCapacityFor`, not `maxRefs`.
   * For a `video` model it is frames: 1, or 2 where an end frame is accepted.
   * Shown in the picker always, staged set or not, and it is the whole of what
   * the picker says about limits: the panel no longer enforces one, so a set
   * larger than this is truncated at submit and reported on the card.
   */
  capacity: number
}
