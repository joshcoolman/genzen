import type { ModelCategory } from '@/features/ai-images/models'

export type ModelCapability = 'generate' | 'edit'
export type SelectionMode = 'single' | 'multi'

export interface UnifiedModel {
  id: string
  name: string
  description: string
  capability: ModelCapability
  category?: ModelCategory
  maxRefImages?: number
}

export interface ModelSelectorProps {
  capability: ModelCapability
  mode: SelectionMode
  selectedIds: Array<string>
  visibleIds: Array<string>
  onSelectionChange: (ids: Array<string>) => void
  onVisibilityChange: (ids: Array<string>) => void
  showGensPerModel?: boolean
  gensPerModel?: number
  onGensChange?: (gens: number) => void
}
