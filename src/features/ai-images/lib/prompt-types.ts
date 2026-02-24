/**
 * Type definitions for the AI prompt generator
 */

export type PromptTheme = 'general' | 'fantasy-scifi'

export type MediumType = 'photography' | 'art' | '3d'

export interface Medium {
  text: string
  type: MediumType
}

export interface AspectRatioEntry {
  value: string
  weight: number
  use: string
}

export interface PromptParts {
  subject: string
  action: string
  medium: Medium
  atmosphere: string
  technical: Array<string>
  wildcard?: string
  aspectRatio: string
}

export interface PromptMetadata {
  mediumType: MediumType
  hasChaosMode: boolean
  hasWildcard: boolean
  aspectRatio: string
  technicalCount: number
}

export interface GeneratedPrompt {
  prompt: string
  parts: PromptParts
  metadata: PromptMetadata
}

export interface PromptGenerationOptions {
  forceAspectRatio?: string
  theme?: PromptTheme
}

export interface PromptComponents {
  subjectType: 'person' | 'couple' | 'group' | 'animal' | 'object' | 'place'
  // Person components (if applicable)
  age?: string
  gender?: string
  ethnicity?: string
  descriptor?: string
  profession?: string
  bodyType?: string
  // Relationship (if couple/group)
  relationship?: string
  // Non-person subjects
  animalType?: string
  objectType?: string
  placeType?: string
  // Context
  action?: string
  environment?: string
  // Technical
  lens: string
  film: string
  framing?: string
  aspectRatio: string
  // Theme
  theme?: PromptTheme
}
