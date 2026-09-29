/**
 * User Images Feature Module
 *
 * Exports all public APIs for the user images feature.
 */

// Types
export type {
  UserImage,
  CreateUserImageInput,
  UserImageFilters,
  CollectedImage,
} from './types'

// Utilities
export { computeFileHash } from './lib/file-hash'

// Hooks
export { useUserImages } from './hooks/use-user-images'
export { useExistingImages } from './hooks/use-existing-images'

// The one write path into the library
export { saveFileToLibrary } from './lib/save-to-library'
export type { SaveToLibraryInput } from './lib/save-to-library'
