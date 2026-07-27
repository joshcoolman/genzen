/**
 * User Images Feature Module
 *
 * Exports all public APIs for the user images feature.
 */

// Types
export type {
  UserImage,
  CreateUserImageInput,
  UpdateUserImageInput,
  UserImageFilters,
  CollectedImage,
} from './types'

// Validation Schemas
export { createUserImageSchema, updateUserImageSchema } from './types'

// Utilities
export {
  computeFileHash,
  isValidSHA256Hash,
  computeAndValidateFileHash,
} from './lib/file-hash'
export { parseFilenameToTitle, sanitizeFilename } from './lib/filename-parser'

// Hooks
export { useUserImages } from './hooks/useUserImages'
export { useExistingImages } from './hooks/useExistingImages'
export { useImageUpload } from './hooks/useImageUpload'
