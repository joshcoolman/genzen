/**
 * Shared file processing for image uploads.
 *
 * Used by both the file picker (ImageUploadButton) and clipboard paste handler.
 */

import { parseFilenameToTitle } from './filename-parser'

/**
 * Process an array of image files: generate title and upload in parallel.
 * Hash computation is handled inside the upload function (runs parallel with storage upload).
 */
export async function processAndUploadFiles(
  files: Array<File>,
  onUpload: (file: File, title: string) => Promise<void>,
): Promise<void> {
  await Promise.allSettled(
    files.map((file) => {
      const title = parseFilenameToTitle(file.name)
      return onUpload(file, title)
    }),
  )
}
