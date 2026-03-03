import { createUserImageSchema } from '../types'
import { computeFileHash } from './file-hash'
import { parseFilenameToTitle } from './filename-parser'
import type { CreateUserImageInput } from '../types'

export async function processAndUploadFiles(
  files: Array<File>,
  onUpload: (input: CreateUserImageInput) => Promise<void>,
): Promise<void> {
  for (const file of files) {
    const file_hash = await computeFileHash(file)
    const title = parseFilenameToTitle(file.name)

    const input: CreateUserImageInput = {
      file,
      file_hash,
      title,
      description: null,
    }

    const validationResult = createUserImageSchema.safeParse(input)
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error)
      continue
    }

    await onUpload(input)
  }
}
