export interface ParsedFileName {
  order: number
  slug: string
  fileName: string
}

/**
 * Parse a filename like "01-progress.md" into { order: 1, slug: "progress" }
 * Files without numeric prefix get order Infinity.
 */
export function parseFileName(fileName: string): ParsedFileName {
  const name = fileName.replace(/\.md$/, '')
  const match = name.match(/^(\d+)-(.+)$/)

  if (match) {
    return {
      order: parseInt(match[1], 10),
      slug: match[2],
      fileName,
    }
  }

  return {
    order: Infinity,
    slug: name,
    fileName,
  }
}

export function sortFileNames(fileNames: string[]): string[] {
  return [...fileNames].sort((a, b) => {
    const pa = parseFileName(a)
    const pb = parseFileName(b)
    if (pa.order !== pb.order) return pa.order - pb.order
    return pa.slug.localeCompare(pb.slug)
  })
}
