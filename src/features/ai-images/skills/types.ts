export interface ImageSkillDefinition {
  id: 'storyboard'
  version: number
  command: string
  label: string
  description: string
  input: { briefRequired: boolean; references: 'optional' }
  defaults: { shots: number; shotAspectRatio: '16:9' }
}

export interface StoryboardPlan {
  continuity: string
  references: Array<{ image: number; role: string }>
  shots: Array<{
    number: number
    description: string
    referenceImages: Array<number>
  }>
  shotAspectRatio: '16:9'
}

export interface StoryboardLayout {
  columns: number
  rows: number
  emptyCells: number
  readingOrder: 'left-to-right, top-to-bottom'
  shotAspectRatio: '16:9'
  idealSheetRatio: string
  sheetAspectRatio: string
  size:
    | { aspect_ratio: string }
    | { image_size: string | { width: number; height: number } }
  /** Insets preserve cinematic shots when the endpoint cannot match the grid. */
  fit: 'fill' | 'letterbox'
}

export interface PreparedImageSkill {
  id: 'storyboard'
  version: number
  preparationId: string
  originalInput: string
  brief: string
  referenceIds: Array<string>
  plan: StoryboardPlan
  model: string
  layout: StoryboardLayout
  preparation: {
    model: string
    inputTokens: number
    outputTokens: number
    durationMs: number
  }
}
