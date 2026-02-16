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
  SUBJECT_MODIFIERS,
  SUBJECT_NOUNS,
  SUBJECTS_PEOPLE,
  SUBJECTS_PLACES,
  SUBJECTS_CREATURES,
  ACTIONS,
  MEDIUMS,
  ATMOSPHERES,
  CAMERA_LENSES,
  CAMERA_FRAMING,
  FILM_STOCKS,
  ART_TECHNIQUES,
  RENDER_ENGINES,
  WILDCARDS,
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
// SUBJECT GENERATION
// ============================================================================

/**
 * Generate a subject using adjective-subject multiplier or dedicated pools
 */
function generateSubject(): string {
  // 30% chance: Combine modifier + noun for surprising results
  if (chance(0.3)) {
    const modifier = pick(SUBJECT_MODIFIERS)
    const noun = pick(SUBJECT_NOUNS)
    return `A ${modifier.toLowerCase()} ${noun}`
  }

  // 70% chance: Pick from dedicated subject pools
  // Equal distribution between people, places, creatures
  const pools = [SUBJECTS_PEOPLE, SUBJECTS_PLACES, SUBJECTS_CREATURES] as const
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
 * Generate a complete AI image prompt with all rules and commitment logic
 */
export function generatePrompt(
  options: PromptGenerationOptions = {},
): GeneratedPrompt {
  // Parse options with defaults
  const {
    wildcardChance = 0.15,
    chaosModeChance = 0.1,
    disableWildcards = false,
    disableChaosMode = false,
    forceMediumType,
    forceAspectRatio,
  } = options

  // 1. Chaos Mode Check (10% chance for contrast pairing)
  const isChaosMode = disableChaosMode ? false : chance(chaosModeChance)

  // 2. Subject Generation
  const subject = generateSubject()

  // 3. Action
  const action = pick(ACTIONS)

  // 4. Medium (with type)
  let medium: Medium
  if (forceMediumType) {
    const filteredMediums = MEDIUMS.filter((m) => m.type === forceMediumType)
    medium = pick(filteredMediums)
  } else {
    medium = pick(MEDIUMS)
  }

  // 5. Atmosphere
  const atmosphere = pick(ATMOSPHERES)

  // 6. Technical Details (COMMITMENT LOGIC)
  const technical = generateTechnicalDetails(medium.type)

  // 7. Wildcard Injection (15% chance)
  let wildcard: string | undefined
  if (!disableWildcards && chance(wildcardChance)) {
    wildcard = pick(WILDCARDS)
  }

  // 8. Aspect Ratio
  const aspectRatio = forceAspectRatio || pickWeighted(ASPECT_RATIOS)

  // 9. Assemble Parts
  const parts: PromptParts = {
    subject,
    action,
    medium,
    atmosphere,
    technical,
    wildcard,
    aspectRatio,
  }

  // 10. Generate Final Prompt
  const prompt = assemblePrompt(parts)

  // 11. Build Metadata
  const metadata = {
    mediumType: medium.type,
    hasChaosMode: isChaosMode,
    hasWildcard: !!wildcard,
    aspectRatio,
    technicalCount: technical.length,
  }

  return {
    prompt,
    parts,
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
