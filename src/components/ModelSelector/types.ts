export type ModelCapability = 'generate' | 'edit' | 'sidebar'
export type SelectionMode = 'single' | 'multi'

export interface UnifiedModel {
  id: string
  name: string
  description: string
  capability: ModelCapability
  editId?: string
  maxRefImages?: number
}
