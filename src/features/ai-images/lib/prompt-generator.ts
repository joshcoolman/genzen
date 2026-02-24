/**
 * Core AI prompt generation algorithm
 * Implements sophisticated template-based generation with commitment logic
 */

import {
  ACTIONS,
  AGES,
  ANIMAL_TYPES,
  ASPECT_RATIOS,
  BODY_TYPES,
  CAMERA_FRAMING,
  CAMERA_LENSES,
  DESCRIPTORS,
  ENVIRONMENTS,
  ETHNICITIES,
  FANTASY_ACTIONS,
  FANTASY_ANIMAL_TYPES,
  FANTASY_DESCRIPTORS,
  FANTASY_ENVIRONMENTS,
  FANTASY_OBJECT_TYPES,
  FANTASY_PLACE_TYPES,
  FANTASY_PROFESSIONS,
  FILM_STOCKS,
  GENDERS,
  OBJECT_TYPES,
  PLACE_TYPES,
  PROFESSIONS,
  RELATIONSHIPS,
} from './prompt-keywords'
import type { PromptComponents, PromptGenerationOptions } from './prompt-types'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Pick a random element from an array
 */
function pick<T>(arr: ReadonlyArray<T>): T {
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
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate modular components for Claude to assemble
 * Returns raw components that will be sent to Claude for natural language assembly
 */
export function generatePromptComponents(
  options: PromptGenerationOptions = {},
): PromptComponents {
  const { forceAspectRatio, theme = 'general' } = options
  const isFantasy = theme === 'fantasy-scifi'

  // Pick pools based on theme
  const professions = isFantasy ? FANTASY_PROFESSIONS : PROFESSIONS
  const descriptors = isFantasy ? FANTASY_DESCRIPTORS : DESCRIPTORS
  const animalTypes = isFantasy ? FANTASY_ANIMAL_TYPES : ANIMAL_TYPES
  const objectTypes = isFantasy ? FANTASY_OBJECT_TYPES : OBJECT_TYPES
  const placeTypes = isFantasy ? FANTASY_PLACE_TYPES : PLACE_TYPES
  const environments = isFantasy ? FANTASY_ENVIRONMENTS : ENVIRONMENTS
  const actions = isFantasy ? FANTASY_ACTIONS : ACTIONS

  // Decide subject type -- fantasy shifts weight from couples to person/animal/place
  const subjectWeights = isFantasy
    ? [
        { type: 'person' as const, weight: 40 },
        { type: 'couple' as const, weight: 5 },
        { type: 'place' as const, weight: 25 },
        { type: 'animal' as const, weight: 20 },
        { type: 'object' as const, weight: 10 },
      ]
    : [
        { type: 'person' as const, weight: 35 },
        { type: 'couple' as const, weight: 20 },
        { type: 'place' as const, weight: 25 },
        { type: 'animal' as const, weight: 12 },
        { type: 'object' as const, weight: 8 },
      ]
  const totalWeight = subjectWeights.reduce((sum, s) => sum + s.weight, 0)
  let random = Math.random() * totalWeight
  let subjectType: (typeof subjectWeights)[number]['type'] = 'person'
  for (const entry of subjectWeights) {
    random -= entry.weight
    if (random <= 0) {
      subjectType = entry.type
      break
    }
  }

  const components: PromptComponents = {
    subjectType,
    lens: pick(CAMERA_LENSES),
    film: pick(FILM_STOCKS),
    framing: chance(0.7) ? pick(CAMERA_FRAMING) : undefined,
    aspectRatio: forceAspectRatio || pickWeighted(ASPECT_RATIOS),
    action: chance(0.7) ? pick(actions) : undefined,
    environment: chance(0.6) ? pick(environments) : undefined,
    theme: isFantasy ? 'fantasy-scifi' : undefined,
  }

  // Pick subject-specific components
  if (subjectType === 'person') {
    components.age = chance(0.8) ? pick(AGES) : undefined
    components.gender = pick(GENDERS)
    components.ethnicity =
      !isFantasy && chance(0.7) ? pick(ETHNICITIES) : undefined
    components.descriptor = chance(0.6) ? pick(descriptors) : undefined
    components.profession = chance(0.8) ? pick(professions) : undefined
    components.bodyType = chance(0.3) ? pick(BODY_TYPES) : undefined
  } else if (subjectType === 'couple') {
    components.relationship = pick(RELATIONSHIPS)
    components.age = chance(0.6) ? pick(AGES) : undefined
    components.ethnicity =
      !isFantasy && chance(0.7) ? pick(ETHNICITIES) : undefined
    components.descriptor = chance(0.5) ? pick(descriptors) : undefined
  } else if (subjectType === 'animal') {
    components.animalType = pick(animalTypes)
    components.descriptor = chance(0.5) ? pick(descriptors) : undefined
  } else if (subjectType === 'object') {
    components.objectType = pick(objectTypes)
    components.descriptor = chance(0.4) ? pick(descriptors) : undefined
  } else {
    components.placeType = pick(placeTypes)
    components.descriptor = chance(0.5) ? pick(descriptors) : undefined
  }

  return components
}
