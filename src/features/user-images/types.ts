/**
 * User Images Types
 *
 * Types for the user images feature. `UserImage` is the `user_images` row
 * shape from `#/lib/types/db`, which is hand-written -- the generated Supabase
 * types it used to come from went with #176.
 */

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
 * Filter options for querying images
 */
export interface UserImageFilters {
  search_term?: string
  limit?: number
  offset?: number
}

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
