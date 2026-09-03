/**
 * User Images Types
 *
 * Types for the user images feature. `UserImage` is the `user_images` row
 * shape from `#/lib/types/db`, which is hand-written -- the generated Supabase
 * types it used to come from went with #176.
 */

import { z } from 'zod'
import type { UserImageRow } from '#/lib/types/db'

/**
 * A user-uploaded image (from database)
 */
export type UserImage = UserImageRow

/**
 * Data required to create a new user image
 */
export interface CreateUserImageInput {
  title: string
  description?: string | null
  file: File
  file_hash?: string
}

export interface CollectedImage {
  id: string
  title: string
  url: string
  source: string
  addedInSession: boolean
}

/**
 * Data required to update an existing user image
 */
export interface UpdateUserImageInput {
  id: string
  title?: string
  description?: string | null
}

/**
 * Filter options for querying images
 */
export interface UserImageFilters {
  search_term?: string
  limit?: number
  offset?: number
}

// Zod Schemas for validation

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/**
 * The largest file the library takes, in bytes (#482).
 *
 * **This number and two limits in `next.config.ts` are one decision.** An
 * upload reaches the server base64'd inside a Server Action call, a third
 * larger than the file, and it passes through `proxy.ts` on the way -- so
 * `serverActions.bodySizeLimit` and `experimental.proxyClientMaxBodySize` both
 * have to admit it. 15MB of file is 20MB encoded; both are set to 22mb.
 *
 * This was fiction until all three were set together: the declared limit said
 * 50MB, nothing checked it, and a 9MB file died against
 * `proxyClientMaxBodySize`'s 10MB default -- which truncates rather than
 * failing, so it surfaced as an unterminated JSON string and a card that
 * silently disappeared.
 *
 * Raising it means raising both. Removing it properly means not sending bytes
 * through an action at all -- a presigned PUT straight to the bucket (#483).
 */
export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

/**
 * Schema for creating a new user image
 */
export const createUserImageSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),

  /* No length cap (#582). The 1000 that used to be here mirrored a database
     check that no longer exists, and on a generation this field holds the
     prompt -- Shots and Lighting routinely write three or four thousand
     characters. */
  description: z.string().trim().nullable().optional(),

  file: z
    .instanceof(File, { message: 'File is required' })
    .refine((file) => file.size > 0, 'File cannot be empty')
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    })
    .refine(
      (file) =>
        ALLOWED_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_MIME_TYPES)[number],
        ),
      {
        message: `File type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
      },
    ),

  file_hash: z
    .string()
    .length(64, 'File hash must be a valid SHA-256 hash (64 hex characters)')
    .regex(/^[a-f0-9]{64}$/, 'File hash must be a valid SHA-256 hash')
    .optional(),
})

/**
 * Schema for updating an existing user image
 */
export const updateUserImageSchema = z.object({
  id: z.string().uuid('Invalid image ID'),

  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be 200 characters or less')
    .trim()
    .optional(),

  /* No length cap (#582). The 1000 that used to be here mirrored a database
     check that no longer exists, and on a generation this field holds the
     prompt -- Shots and Lighting routinely write three or four thousand
     characters. */
  description: z.string().trim().nullable().optional(),
})

/**
 * Tailwind shade scale (50-950)
 * 11 shades from lightest to darkest
 */
export interface ShadeScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

/**
 * Color palette v3: 8 hue-diverse colors with shade scales
 */
export interface ColorPalette {
  colors: Array<ShadeScale>
  metadata: {
    extractionMethod: 'lab-kmeans'
    version: 3
  }
}
