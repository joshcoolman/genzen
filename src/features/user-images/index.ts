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
} from "./types";

// Validation Schemas
export { createUserImageSchema, updateUserImageSchema } from "./types";

// Utilities
export {
  computeFileHash,
  isValidSHA256Hash,
  computeAndValidateFileHash,
} from "./lib/file-hash";
export { parseFilenameToTitle, sanitizeFilename } from "./lib/filename-parser";

// Hooks
export { useUserImages } from "./hooks/useUserImages";

// Components
export { UserImagesDisplay } from "./components/UserImagesDisplay";
export { ImageUploadButton } from "./components/ImageUploadButton";
export { ImageCard } from "./components/ImageCard";
export { ImageGrid, EmptyState } from "./components/ImageGrid";
