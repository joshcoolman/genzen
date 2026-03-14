export type ModelCapability = 'generate' | 'edit'
export type SelectionMode = 'single' | 'multi'

export interface UnifiedModel {
  id: string
  name: string
  description: string
  capability: ModelCapability
  maxRefImages?: number
}
