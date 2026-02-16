/**
 * Core AI prompt generation algorithm
 * Implements sophisticated template-based generation with commitment logic
 */

import type {
  GeneratedPrompt,
  PromptGenerationOptions,
  PromptParts,
  MediumType,
  Medium,
} from './prompt-types'
import {
  SUBJECTS_PEOPLE,
  SUBJECTS_PLACES,
  SUBJECTS_ANIMALS,
  SUBJECTS_OBJECTS,
  ACTIONS,
  ENVIRONMENTS,
  CAMERA_LENSES,
  CAMERA_FRAMING,
  FILM_STOCKS,
  ASPECT_RATIOS,
} from './prompt-keywords'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Pick a random element from an array
 */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Weighted random selection for aspect ratios
 */
function pickWeighted(items: typeof ASPECT_RATIOS): string {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight

  for (const item of items) {
    random -= item.weight
    if (random <= 0) {
      return item.value
    }
  }

  // Fallback (should never reach here)
  return items[0].value
}

/**
 * Check if random chance succeeds
 */
function chance(probability: number): boolean {
  return Math.random() < probability
}

// ============================================================================
// SUBJECT GENERATION (Photography-focused)
// ============================================================================

/**
 * Generate a subject - equal distribution across people, places, animals, objects
 */
function generateSubject(): string {
  const pools = [
    SUBJECTS_PEOPLE,
    SUBJECTS_PLACES,
    SUBJECTS_ANIMALS,
    SUBJECTS_OBJECTS,
  ] as const

  const selectedPool = pick(pools)
  return pick(selectedPool)
}

// ============================================================================
// TECHNICAL DETAILS GENERATION (Commitment Logic)
// ============================================================================

/**
 * Generate technical details based on medium type
 * COMMITMENT LOGIC: Never mix camera specs with art techniques with 3D render settings
 */
function generateTechnicalDetails(mediumType: MediumType): string[] {
  const technical: string[] = []

  if (mediumType === 'photography') {
    // MUST include: lens + film stock
    technical.push(pick(CAMERA_LENSES))
    technical.push(pick(FILM_STOCKS))

    // Optional: framing (50% chance)
    if (chance(0.5)) {
      technical.push(pick(CAMERA_FRAMING))
    }

    // MUST NOT include: art techniques, render engines
  } else if (mediumType === 'art') {
    // MUST include: art technique
    technical.push(pick(ART_TECHNIQUES))

    // Optional: additional technique (30% chance)
    if (chance(0.3)) {
      const secondTechnique = pick(
        ART_TECHNIQUES.filter((t) => t !== technical[0]),
      )
      technical.push(secondTechnique)
    }

    // Optional: framing (40% chance)
    if (chance(0.4)) {
      technical.push(pick(CAMERA_FRAMING))
    }

    // MUST NOT include: camera lenses, film stocks, render engines
  } else if (mediumType === '3d') {
    // MUST include: render engine technique
    technical.push(pick(RENDER_ENGINES))

    // Optional: additional render technique (50% chance)
    if (chance(0.5)) {
      const secondTechnique = pick(
        RENDER_ENGINES.filter((t) => t !== technical[0]),
      )
      technical.push(secondTechnique)
    }

    // Optional: framing (40% chance)
    if (chance(0.4)) {
      technical.push(pick(CAMERA_FRAMING))
    }

    // MUST NOT include: camera lenses, film stocks, art techniques
  }

  return technical
}

// ============================================================================
// PROMPT ASSEMBLY
// ============================================================================

/**
 * Assemble final prompt string from parts
 * Format: {subject} {action}, {medium}, {atmosphere}, {technical}, [wildcard] --ar {aspectRatio}
 */
function assemblePrompt(parts: PromptParts): string {
  const segments: string[] = []

  // Subject + action (front-loaded for importance)
  segments.push(`${parts.subject} ${parts.action}`)

  // Medium
  segments.push(parts.medium.text)

  // Atmosphere
  segments.push(parts.atmosphere)

  // Technical details
  segments.push(...parts.technical)

  // Optional wildcard
  if (parts.wildcard) {
    segments.push(parts.wildcard)
  }

  // Join with commas and add aspect ratio flag
  const prompt = segments.join(', ')
  return `${prompt} --ar ${parts.aspectRatio}`
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate a photography prompt using template system
 * Format: [subject] [action] [environment], [lens], [film], [framing] --ar [ratio]
 */
export function generatePrompt(
  options: PromptGenerationOptions = {},
): GeneratedPrompt {
  const { forceAspectRatio } = options

  // 1. Pick subject (people, places, animals, or objects)
  const subject = generateSubject()

  // 2. Pick action (optional - 70% chance to include)
  const action = chance(0.7) ? pick(ACTIONS) : ''

  // 3. Pick environment (optional - 60% chance to include)
  const environment = chance(0.6) ? pick(ENVIRONMENTS) : ''

  // 4. Pick camera technical specs (3-4 items)
  const lens = pick(CAMERA_LENSES)
  const film = pick(FILM_STOCKS)
  const framing = chance(0.7) ? pick(CAMERA_FRAMING) : '' // Optional framing

  // 5. Pick aspect ratio
  const aspectRatio = forceAspectRatio || pickWeighted(ASPECT_RATIOS)

  // 6. Assemble prompt in natural order
  const parts = [subject]
  if (action) parts.push(action)
  if (environment) parts.push(environment)

  const subjectPart = parts.join(' ')
  const technical = [lens, film, framing].filter(Boolean)

  const prompt = `${subjectPart}, ${technical.join(', ')} --ar ${aspectRatio}`

  // 7. Build parts object (simplified for photography)
  const promptParts: PromptParts = {
    subject,
    action,
    medium: { text: 'Photography', type: 'photography' },
    atmosphere: environment || '',
    technical,
    aspectRatio,
  }

  // 8. Build metadata
  const metadata = {
    mediumType: 'photography' as const,
    hasChaosMode: false,
    hasWildcard: false,
    aspectRatio,
    technicalCount: technical.length,
  }

  return {
    prompt,
    parts: promptParts,
    metadata,
  }
}

/**
 * Generate multiple prompts at once
 */
export function generatePrompts(
  count: number,
  options: PromptGenerationOptions = {},
): GeneratedPrompt[] {
  return Array.from({ length: count }, () => generatePrompt(options))
}
