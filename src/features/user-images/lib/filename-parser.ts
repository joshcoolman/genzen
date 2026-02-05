/**
 * Filename Parser Utilities
 *
 * Utilities for parsing filenames into human-readable titles.
 */

/**
 * Converts a filename to a title-cased string
 *
 * Process:
 * 1. Remove file extension
 * 2. Replace underscores and dashes with spaces
 * 3. Convert to title case
 * 4. Trim extra whitespace
 */
export function parseFilenameToTitle(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const withSpaces = withoutExtension.replace(/[_-]+/g, " ");
  const titleCased = withSpaces
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
  return titleCased.trim();
}

/**
 * Validates and sanitizes a filename
 *
 * Removes any characters that might cause issues in storage paths
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
}
