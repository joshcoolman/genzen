import type { TocHeading } from './types'
import { slugify } from './slugify'

/**
 * Extract H2 headings from raw markdown for table of contents.
 */
export function extractHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = []
  const lines = markdown.split('\n')

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      const text = match[1].trim()
      headings.push({
        id: slugify(text),
        text,
        level: 2,
      })
    }
  }

  return headings
}
