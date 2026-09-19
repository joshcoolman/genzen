export interface PromptImageSkillDefinition {
  id: 'storyboard'
  version: number
  command: string
  label: string
  description: string
  input: { briefRequired: boolean; references: 'optional' }
  defaults: { shots: number; shotAspectRatio: string }
}

export interface StoryboardPlan {
  continuity: string
  held: string
  varies: string
  ordered: boolean
  references: Array<{ image: number; role: string }>
  shots: Array<{
    number: number
    description: string
    referenceImages: Array<number>
  }>
  shotAspectRatio: string
}

export interface StoryboardLayout {
  columns: number
  rows: number
  emptyCells: number
  readingOrder: 'left-to-right, top-to-bottom'
  shotAspectRatio: string
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
  /** Present on v2 individual-shot renders; absent on legacy contact sheets. */
  shotNumber?: number
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
