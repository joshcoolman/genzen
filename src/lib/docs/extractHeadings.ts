import { slugify } from './slugify'
import type { TocHeading } from './types'

/**
 * Extract H2 headings from raw markdown for table of contents.
 */
export function extractHeadings(markdown: string): Array<TocHeading> {
  const headings: Array<TocHeading> = []
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
