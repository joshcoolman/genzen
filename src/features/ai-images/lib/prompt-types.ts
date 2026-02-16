/**
 * Type definitions for the AI prompt generator
 */

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
  technical: string[]
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
  wildcardChance?: number // 0-1, default 0.15
  chaosModeChance?: number // 0-1, default 0.10
  disableWildcards?: boolean
  disableChaosMode?: boolean
  forceMediumType?: MediumType
  forceAspectRatio?: string
}
