/**
 * File Hashing Utilities
 *
 * Utilities for computing SHA-256 hashes of file contents.
 * Used for duplicate detection - identical files produce identical hashes.
 */

/**
 * Computes the SHA-256 hash of a file's contents
 *
 * Uses the Web Crypto API (available in modern browsers).
 * The hash is computed client-side to avoid sending file contents to the server.
 */
export async function computeFileHash(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    return hashHex
  } catch (error) {
    throw new Error(
      `Failed to compute file hash: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
